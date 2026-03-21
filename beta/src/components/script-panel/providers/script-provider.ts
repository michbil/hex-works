/**
 * Script provider interface — abstraction for script storage backends.
 *
 * Providers supply script metadata (lightweight, always loaded) separately
 * from script bodies (loaded on demand when a script is selected).
 */

/** Lightweight script metadata — no code body */
export interface ScriptMeta {
  id: string;
  name: string;
  type: 'script' | 'folder';
  scriptClass?: 'cli' | 'ui';
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  providerId: string;
  readOnly?: boolean;
}

/** Interface that all script sources must implement */
export interface ScriptProvider {
  readonly id: string;
  readonly label: string;

  /** Load all metadata (no code bodies). Called on init. */
  loadMetas(): Promise<ScriptMeta[]>;

  /** Fetch the code body for a single script. */
  loadCode(scriptId: string): Promise<string>;

  /** Save code for a script. Throws if readOnly. */
  saveCode(scriptId: string, code: string): Promise<void>;

  /** Create a new script, return its metadata. */
  createScript(name: string, parentId: string | null, code: string, scriptClass: 'cli' | 'ui'): Promise<ScriptMeta>;

  /** Create a new folder, return its metadata. */
  createFolder(name: string, parentId: string | null): Promise<ScriptMeta>;

  /** Rename a node. */
  renameNode(id: string, name: string): Promise<void>;

  /** Delete a node and all descendants. */
  deleteNode(id: string): Promise<void>;
}

/** Build the full path string for a node (e.g. "Folder / Sub / Script") */
export function getNodePath(nodes: ScriptMeta[], id: string): string {
  const parts: string[] = [];
  let current = nodes.find(n => n.id === id);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return parts.join(' / ');
}

/** Get children of a parent (null = root), sorted folders-first then alphabetical */
export function getChildren(nodes: ScriptMeta[], parentId: string | null): ScriptMeta[] {
  return nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
