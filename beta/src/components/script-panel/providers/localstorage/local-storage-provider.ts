/**
 * LocalStorage-backed script provider.
 *
 * Stores script metadata and code in localStorage as a JSON array.
 * Code bodies are separated from metadata at load time so that only
 * the lightweight metas are kept in React state.
 */

import type { ScriptProvider, ScriptMeta } from '../script-provider';

const STORAGE_KEY = 'hexworks_scripts';
const PROVIDER_ID = 'localStorage';

/** Internal storage format (includes code) */
interface StoredNode {
  id: string;
  name: string;
  type: 'script' | 'folder';
  scriptClass?: 'cli' | 'ui';
  parentId: string | null;
  code?: string;
  createdAt: number;
  updatedAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readAll(): StoredNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredNode[];
  } catch {
    return [];
  }
}

function writeAll(nodes: StoredNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  } catch (e) {
    console.error('Failed to save scripts:', e);
  }
}

function toMeta(node: StoredNode): ScriptMeta {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    scriptClass: node.scriptClass,
    parentId: node.parentId,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    providerId: PROVIDER_ID,
  };
}

/** Collect a node and all its descendants */
function collectDescendants(nodes: StoredNode[], id: string): Set<string> {
  const ids = new Set<string>();
  ids.add(id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

export class LocalStorageProvider implements ScriptProvider {
  readonly id = PROVIDER_ID;
  readonly label = 'Local Scripts';

  /** Code cache: scriptId → code string */
  private codeCache = new Map<string, string>();

  async loadMetas(): Promise<ScriptMeta[]> {
    const nodes = readAll();
    // Populate code cache while we have the full data
    this.codeCache.clear();
    for (const n of nodes) {
      if (n.type === 'script' && n.code != null) {
        this.codeCache.set(n.id, n.code);
      }
    }
    return nodes.map(toMeta);
  }

  async loadCode(scriptId: string): Promise<string> {
    // Try cache first
    const cached = this.codeCache.get(scriptId);
    if (cached != null) return cached;
    // Fall back to re-reading storage
    const nodes = readAll();
    const node = nodes.find(n => n.id === scriptId);
    const code = node?.code ?? '';
    this.codeCache.set(scriptId, code);
    return code;
  }

  async saveCode(scriptId: string, code: string): Promise<void> {
    const nodes = readAll();
    const updated = nodes.map(n =>
      n.id === scriptId ? { ...n, code, updatedAt: Date.now() } : n,
    );
    writeAll(updated);
    this.codeCache.set(scriptId, code);
  }

  async createScript(
    name: string,
    parentId: string | null,
    code: string,
    scriptClass: 'cli' | 'ui',
  ): Promise<ScriptMeta> {
    const node: StoredNode = {
      id: generateId(),
      name,
      type: 'script',
      scriptClass,
      parentId,
      code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nodes = readAll();
    nodes.push(node);
    writeAll(nodes);
    this.codeCache.set(node.id, code);
    return toMeta(node);
  }

  async createFolder(name: string, parentId: string | null): Promise<ScriptMeta> {
    const node: StoredNode = {
      id: generateId(),
      name,
      type: 'folder',
      parentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nodes = readAll();
    nodes.push(node);
    writeAll(nodes);
    return toMeta(node);
  }

  async renameNode(id: string, name: string): Promise<void> {
    const nodes = readAll();
    const updated = nodes.map(n =>
      n.id === id ? { ...n, name, updatedAt: Date.now() } : n,
    );
    writeAll(updated);
  }

  async deleteNode(id: string): Promise<void> {
    const nodes = readAll();
    const toDelete = collectDescendants(nodes, id);
    const updated = nodes.filter(n => !toDelete.has(n.id));
    writeAll(updated);
    for (const deletedId of toDelete) {
      this.codeCache.delete(deletedId);
    }
  }
}
