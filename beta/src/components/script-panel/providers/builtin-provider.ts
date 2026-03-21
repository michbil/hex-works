/**
 * Built-in scripts provider — read-only example scripts.
 *
 * Exposes default templates as a virtual "Examples" folder so users
 * can browse them without polluting localStorage.
 */

import type { ScriptProvider, ScriptMeta } from './script-provider';
import { DEFAULT_NEW_SCRIPT, DEFAULT_NEW_UI_SCRIPT } from './script-templates';

const PROVIDER_ID = 'builtins';
const FOLDER_ID = 'builtins_examples';
const CLI_EXAMPLE_ID = 'builtins_cli_example';
const UI_EXAMPLE_ID = 'builtins_ui_example';

const METAS: ScriptMeta[] = [
  {
    id: FOLDER_ID,
    name: 'Examples',
    type: 'folder',
    parentId: null,
    createdAt: 0,
    updatedAt: 0,
    providerId: PROVIDER_ID,
    readOnly: true,
  },
  {
    id: CLI_EXAMPLE_ID,
    name: 'CLI Example',
    type: 'script',
    scriptClass: 'cli',
    parentId: FOLDER_ID,
    createdAt: 0,
    updatedAt: 0,
    providerId: PROVIDER_ID,
    readOnly: true,
  },
  {
    id: UI_EXAMPLE_ID,
    name: 'UI Example',
    type: 'script',
    scriptClass: 'ui',
    parentId: FOLDER_ID,
    createdAt: 0,
    updatedAt: 0,
    providerId: PROVIDER_ID,
    readOnly: true,
  },
];

const CODE_MAP: Record<string, string> = {
  [CLI_EXAMPLE_ID]: DEFAULT_NEW_SCRIPT,
  [UI_EXAMPLE_ID]: DEFAULT_NEW_UI_SCRIPT,
};

function readOnlyError(): never {
  throw new Error('Built-in scripts are read-only');
}

export class BuiltinProvider implements ScriptProvider {
  readonly id = PROVIDER_ID;
  readonly label = 'Built-in Examples';

  async loadMetas(): Promise<ScriptMeta[]> {
    return METAS;
  }

  async loadCode(scriptId: string): Promise<string> {
    return CODE_MAP[scriptId] ?? '';
  }

  async saveCode(): Promise<void> { readOnlyError(); }
  async createScript(): Promise<ScriptMeta> { readOnlyError(); }
  async createFolder(): Promise<ScriptMeta> { readOnlyError(); }
  async renameNode(): Promise<void> { readOnlyError(); }
  async deleteNode(): Promise<void> { readOnlyError(); }
}
