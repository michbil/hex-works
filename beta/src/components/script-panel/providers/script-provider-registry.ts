/**
 * Script provider registry — aggregates multiple ScriptProviders
 * into a single interface for the UI layer.
 */

import type { ScriptProvider, ScriptMeta } from './script-provider';

export class ScriptProviderRegistry {
  private providers = new Map<string, ScriptProvider>();

  register(provider: ScriptProvider): void {
    this.providers.set(provider.id, provider);
  }

  private getProvider(providerId: string): ScriptProvider {
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`Unknown script provider: ${providerId}`);
    return p;
  }

  /** Load metadata from all providers */
  async loadAllMetas(): Promise<ScriptMeta[]> {
    const results = await Promise.all(
      Array.from(this.providers.values()).map(p => p.loadMetas()),
    );
    return results.flat();
  }

  /** Load code body for a script, routed to the correct provider */
  async loadCode(meta: ScriptMeta): Promise<string> {
    return this.getProvider(meta.providerId).loadCode(meta.id);
  }

  /** Save code, routed to the correct provider */
  async saveCode(meta: ScriptMeta, code: string): Promise<void> {
    return this.getProvider(meta.providerId).saveCode(meta.id, code);
  }

  /** Create a script via a specific provider */
  async createScript(
    providerId: string,
    name: string,
    parentId: string | null,
    code: string,
    scriptClass: 'cli' | 'ui',
  ): Promise<ScriptMeta> {
    return this.getProvider(providerId).createScript(name, parentId, code, scriptClass);
  }

  /** Create a folder via a specific provider */
  async createFolder(
    providerId: string,
    name: string,
    parentId: string | null,
  ): Promise<ScriptMeta> {
    return this.getProvider(providerId).createFolder(name, parentId);
  }

  async renameNode(meta: ScriptMeta, name: string): Promise<void> {
    return this.getProvider(meta.providerId).renameNode(meta.id, name);
  }

  async deleteNode(meta: ScriptMeta): Promise<void> {
    return this.getProvider(meta.providerId).deleteNode(meta.id);
  }
}
