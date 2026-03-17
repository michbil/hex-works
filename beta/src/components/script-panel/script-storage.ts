/**
 * Script storage - persists scripts and folders to localStorage.
 * Supports hierarchical folder structure.
 */

const STORAGE_KEY = 'hexworks_scripts';

export interface ScriptNode {
  id: string;
  name: string;
  type: 'script' | 'folder';
  scriptClass?: 'cli' | 'ui'; // only for type === 'script'; defaults to 'cli'
  parentId: string | null;    // null = root level
  code?: string;              // only for type === 'script'
  createdAt: number;
  updatedAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Load all script nodes from localStorage */
export function loadScriptNodes(): ScriptNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScriptNode[];
  } catch {
    return [];
  }
}

/** Save all script nodes to localStorage */
export function saveScriptNodes(nodes: ScriptNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  } catch (e) {
    console.error('Failed to save scripts:', e);
  }
}

/** Create a new script */
export function createScript(
  nodes: ScriptNode[],
  name: string,
  parentId: string | null,
  code: string = '',
  scriptClass: 'cli' | 'ui' = 'cli',
): { nodes: ScriptNode[]; script: ScriptNode } {
  const script: ScriptNode = {
    id: generateId(),
    name,
    type: 'script',
    scriptClass,
    parentId,
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updated = [...nodes, script];
  saveScriptNodes(updated);
  return { nodes: updated, script };
}

/** Create a new folder */
export function createFolder(
  nodes: ScriptNode[],
  name: string,
  parentId: string | null,
): { nodes: ScriptNode[]; folder: ScriptNode } {
  const folder: ScriptNode = {
    id: generateId(),
    name,
    type: 'folder',
    parentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updated = [...nodes, folder];
  saveScriptNodes(updated);
  return { nodes: updated, folder };
}

/** Update a script's code (auto-save) */
export function updateScriptCode(nodes: ScriptNode[], id: string, code: string): ScriptNode[] {
  const updated = nodes.map(n =>
    n.id === id ? { ...n, code, updatedAt: Date.now() } : n,
  );
  saveScriptNodes(updated);
  return updated;
}

/** Rename a node */
export function renameNode(nodes: ScriptNode[], id: string, name: string): ScriptNode[] {
  const updated = nodes.map(n =>
    n.id === id ? { ...n, name, updatedAt: Date.now() } : n,
  );
  saveScriptNodes(updated);
  return updated;
}

/** Delete a node and all descendants (for folders) */
export function deleteNode(nodes: ScriptNode[], id: string): ScriptNode[] {
  const toDelete = new Set<string>();
  toDelete.add(id);

  // Recursively find all children
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        changed = true;
      }
    }
  }

  const updated = nodes.filter(n => !toDelete.has(n.id));
  saveScriptNodes(updated);
  return updated;
}

/** Move a node to a different parent */
export function moveNode(nodes: ScriptNode[], id: string, newParentId: string | null): ScriptNode[] {
  // Prevent moving a folder into itself or its descendants
  if (newParentId !== null) {
    const descendants = new Set<string>();
    descendants.add(id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && descendants.has(n.parentId) && !descendants.has(n.id)) {
          descendants.add(n.id);
          changed = true;
        }
      }
    }
    if (descendants.has(newParentId)) return nodes;
  }

  const updated = nodes.map(n =>
    n.id === id ? { ...n, parentId: newParentId, updatedAt: Date.now() } : n,
  );
  saveScriptNodes(updated);
  return updated;
}

/** Build the full path string for a node (e.g. "Folder / Sub / Script") */
export function getNodePath(nodes: ScriptNode[], id: string): string {
  const parts: string[] = [];
  let current = nodes.find(n => n.id === id);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return parts.join(' / ');
}

/** Get children of a parent (null = root) */
export function getChildren(nodes: ScriptNode[], parentId: string | null): ScriptNode[] {
  return nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => {
      // Folders first, then alphabetical
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
