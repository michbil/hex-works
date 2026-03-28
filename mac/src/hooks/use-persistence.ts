import {useEffect, useRef} from 'react';
import {NativeModules, Platform} from 'react-native';
import {BinaryBuffer} from '@shared/utils/binbuf';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {filePaths, bookmarks} from './use-file-handler';

const {StorageModule, FileDialogModule} = NativeModules;

const STORAGE_KEY = 'hexworks_session';

interface SessionTab {
  path: string;
  name: string;
  bookmark: string;
}

interface SessionData {
  tabs: SessionTab[];
  activeTabIndex: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function save() {
  const state = useHexEditorStore.getState();
  const tabs: SessionTab[] = state.tabs.map(tab => ({
    path: filePaths.get(tab.id) ?? '',
    name: tab.fileName,
    bookmark: bookmarks.get(tab.id) ?? '',
  }));

  const json = JSON.stringify({tabs, activeTabIndex: state.activeTabIndex});

  if (Platform.OS === 'macos') {
    StorageModule.setItem(STORAGE_KEY, json);
  } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, json);
  }
}

async function load(): Promise<SessionData | null> {
  let json: string | null = null;

  if (Platform.OS === 'macos') {
    json = await StorageModule.getItem(STORAGE_KEY);
  } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    json = localStorage.getItem(STORAGE_KEY);
  }

  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function usePersistence() {
  const addTab = useHexEditorStore(s => s.addTab);
  const switchTab = useHexEditorStore(s => s.switchTab);
  const restoredRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        const session = await load();
        if (!session?.tabs?.length) return;

        let loaded = 0;
        for (const tab of session.tabs) {
          if (!tab.path && !tab.bookmark) continue;
          try {
            const result = await FileDialogModule.readFileFromBookmark(
              tab.bookmark || '',
              tab.path || '',
            );
            const bytes = base64ToUint8Array(result.data);
            const buf = new BinaryBuffer(bytes);
            buf.name = result.name;
            // Set maps before addTab (addTab triggers save via subscriber)
            filePaths.set(buf.uuid, result.path);
            if (result.bookmark) {
              bookmarks.set(buf.uuid, result.bookmark);
            }
            addTab(buf, result.name);
            loaded++;
          } catch {
            // File may have been moved/deleted — skip
          }
        }

        if (loaded > 0 && session.activeTabIndex >= 0) {
          switchTab(Math.min(session.activeTabIndex, loaded - 1));
        }
      } catch (err) {
        console.warn('Session restore failed:', err);
      }
    })();
  }, [addTab, switchTab]);

  // Auto-save when tabs change
  useEffect(() => {
    let prevCount = useHexEditorStore.getState().tabs.length;
    let prevActive = useHexEditorStore.getState().activeTabIndex;

    const unsub = useHexEditorStore.subscribe(state => {
      if (state.tabs.length !== prevCount || state.activeTabIndex !== prevActive) {
        prevCount = state.tabs.length;
        prevActive = state.activeTabIndex;
        save();
      }
    });
    return unsub;
  }, []);
}
