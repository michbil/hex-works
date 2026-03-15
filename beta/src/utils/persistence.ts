/**
 * IndexedDB persistence for hex editor tabs.
 *
 * Compatible with the Angular hex-works app's localforage storage format:
 *   - DB name: "localforage"
 *   - Object store: "keyvaluepairs"
 *   - Key "tabnames" → array of UUID strings (tab order)
 *   - Key <uuid> → { name, colors (Uint8Array), data (hex string), uuid }
 *
 * This allows drop-in upgrade from the Angular app — existing saved tabs
 * are picked up automatically.
 */

import { BinaryBuffer } from './binbuf';

// localforage defaults — must match exactly for compatibility
const DB_NAME = 'localforage';
const DB_VERSION = 2; // localforage uses version 2
const STORE_NAME = 'keyvaluepairs';
const TABNAMES_KEY = 'tabnames';

/** Tab data as stored by the Angular app's BinBuf.saveToDict() */
interface TabDict {
  name: string;
  colors: Uint8Array;
  data: string; // hex string
  uuid: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store: IDBObjectStore, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(store: IDBObjectStore, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllKeys(store: IDBObjectStore): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SavedTab {
  buffer: BinaryBuffer;
  fileName: string;
}

/**
 * Save all tabs to IndexedDB in localforage-compatible format.
 * Each tab stored under its UUID key with saveToDict() output.
 * Tab order stored under "tabnames" key as array of UUIDs.
 */
export async function saveTabs(
  tabs: Array<{ id: string; buffer: BinaryBuffer; fileName: string }>,
  activeIndex: number,
  /** When provided, only tabs whose id is in this set will be re-serialized.
   *  Tab order and active index are always saved. */
  dirtyIds?: Set<string>,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Save each tab under its UUID — skip unchanged tabs when dirtyIds provided
    const tabnames: string[] = [];
    for (const tab of tabs) {
      tabnames.push(tab.id);
      if (dirtyIds && !dirtyIds.has(tab.id)) continue;
      const dict = tab.buffer.saveToDict();
      // Store in the same format as Angular's BinBuf.saveToDict()
      await idbPut(store, tab.id, {
        name: tab.fileName,
        colors: dict.colors, // Uint8Array — structured clone handles this
        data: dict.data,     // hex string
        uuid: tab.id,
      } satisfies TabDict);
    }

    // Store tab order (Angular format: just an array of UUIDs)
    await idbPut(store, TABNAMES_KEY, tabnames);

    // Store active index (React extension — Angular doesn't have this,
    // but it won't break Angular since Angular ignores unknown keys)
    await idbPut(store, '__activeIndex__', activeIndex);

    // Clean up tabs that were removed
    const allKeys = await idbGetAllKeys(store);
    const validKeys = new Set<string>([TABNAMES_KEY, '__activeIndex__', ...tabnames]);
    for (const key of allKeys) {
      const k = String(key);
      if (!validKeys.has(k)) {
        await idbDelete(store, k);
      }
    }

    db.close();
  } catch (e) {
    console.error('Failed to save tabs to IndexedDB:', e);
  }
}

/**
 * Restore all tabs from IndexedDB (localforage-compatible format).
 * Reads "tabnames" for tab order, then loads each tab by UUID.
 */
export async function loadTabs(): Promise<{ tabs: SavedTab[]; activeIndex: number } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Read tab order
    const tabnames = await idbGet<string[]>(store, TABNAMES_KEY);
    if (!tabnames || tabnames.length === 0) {
      db.close();
      return null;
    }

    // Read each tab in order
    const tabs: SavedTab[] = [];
    for (const uuid of tabnames) {
      const record = await idbGet<TabDict>(store, uuid);
      if (!record || !record.data) continue;

      const buf = new BinaryBuffer(record.data.length / 2);
      buf.loadFromLocalStorage({
        data: record.data,
        colors: record.colors instanceof Uint8Array
          ? record.colors
          : new Uint8Array(record.colors as unknown as ArrayLike<number>),
        uuid: record.uuid,
      });
      buf.setName(record.name);
      buf.changed = false;
      tabs.push({ buffer: buf, fileName: record.name });
    }

    // Read active index (React extension, may not exist for Angular data)
    const activeIndex = await idbGet<number>(store, '__activeIndex__');

    db.close();

    if (tabs.length === 0) return null;

    const idx = typeof activeIndex === 'number'
      ? Math.min(Math.max(0, activeIndex), tabs.length - 1)
      : 0;
    return { tabs, activeIndex: idx };
  } catch (e) {
    console.error('Failed to load tabs from IndexedDB:', e);
    return null;
  }
}
