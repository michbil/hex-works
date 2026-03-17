/**
 * Vue UI script engine.
 *
 * Supports a Vue SFC-style format with <template>, <script>, and <style> blocks.
 * Templates are compiled at runtime using @vue/compiler-dom. No build step needed.
 *
 * Example script:
 *
 *   <template>
 *     <div class="tool">
 *       <button @click="analyze">Analyze</button>
 *       <pre>{{ output }}</pre>
 *     </div>
 *   </template>
 *
 *   <script>
 *   export default {
 *     data() { return { output: '' }; },
 *     methods: {
 *       analyze() {
 *         this.output = `Size: ${this.$buffer.length} bytes`;
 *         this.$onBufferModified();
 *       }
 *     }
 *   };
 *   </script>
 *
 *   <style>
 *   .tool { padding: 16px; color: #d4d4d4; }
 *   button { background: #2ea043; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; }
 *   </style>
 *
 * Global properties injected into all components (accessible via `this` in Options API):
 *   $buffer        — hex buffer API (same as CLI scripts)
 *   $cursor        — current cursor position
 *   $selection     — { start, end, length }
 *   $print         — print(...args) → pushes to internal log
 *   $hexdump       — hexdump(offset?, length?)
 *   $onBufferModified — call after modifying the buffer to trigger UI refresh
 */

import * as Vue from 'vue';
import { compile } from '@vue/compiler-dom';
import { buildApi } from './script-engine';
import type { ScriptContext } from './script-engine';

export interface UIScriptHandle {
  unmount(): void;
}

export interface UIScriptResult {
  handle: UIScriptHandle;
  error: string | null;
}

/** Parse a Vue SFC string into its three blocks */
function parseSFC(code: string): { template: string; script: string; style: string } {
  const template = /<template>([\s\S]*?)<\/template>/i.exec(code)?.[1]?.trim() ?? '';
  const script   = /<script>([\s\S]*?)<\/script>/i.exec(code)?.[1]?.trim() ?? '';
  const style    = /<style>([\s\S]*?)<\/style>/i.exec(code)?.[1]?.trim() ?? '';
  return { template, script, style };
}

/**
 * Compile a template string to a Vue render function.
 * The compiled code references 'Vue' for runtime helpers, which we supply via new Function.
 */
function compileTemplate(template: string): Function {
  const { code } = compile(template, { mode: 'function', hoistStatic: false });
  // eslint-disable-next-line no-new-func
  return new Function('Vue', code)(Vue);
}

/**
 * Execute the <script> block and extract the component options object.
 * Handles the `export default { ... }` syntax by transforming it to an assignment.
 */
function evalScriptBlock(script: string): Record<string, unknown> {
  const transformed = script.replace(/\bexport\s+default\b/, 'exports.default =');
  const moduleExports: Record<string, unknown> = {};
  // eslint-disable-next-line no-new-func
  new Function('exports', transformed)(moduleExports);
  return (moduleExports.default as Record<string, unknown>) ?? {};
}

/**
 * Mount a Vue UI script into the given container element.
 * Returns a handle with an unmount() method, plus any error.
 */
export function mountUIScript(
  code: string,
  container: HTMLElement,
  ctx: ScriptContext,
  onBufferModified: () => void,
): UIScriptResult {
  try {
    const { template, script, style } = parseSFC(code);

    const componentOptions = evalScriptBlock(script);
    const render = compileTemplate(template);

    const apiOutput: string[] = [];
    const api = buildApi(ctx, apiOutput);

    // Wrap write methods so every mutation immediately notifies the hex editor
    const buf = api.buffer;
    const reactiveBuffer = {
      ...buf,
      setByte(offset: number, value: number)    { buf.setByte(offset, value); onBufferModified(); },
      setBytes(offset: number, bytes: number[]) { buf.setBytes(offset, bytes); onBufferModified(); },
      setColor(offset: number, color: number)   { buf.setColor(offset, color); onBufferModified(); },
      resize(newSize: number)                   { buf.resize(newSize); onBufferModified(); },
    };

    const app = Vue.createApp({ ...componentOptions, render });

    app.config.globalProperties.$buffer          = reactiveBuffer;
    app.config.globalProperties.$cursor          = api.cursor;
    app.config.globalProperties.$selection       = api.selection;
    app.config.globalProperties.$print           = api.print;
    app.config.globalProperties.$hexdump         = api.hexdump;
    app.config.globalProperties.$onBufferModified = onBufferModified;

    // Suppress Vue's "app already has an active instance" dev warning during HMR
    app.config.warnHandler = () => {};

    let styleEl: HTMLStyleElement | null = null;
    if (style) {
      styleEl = document.createElement('style');
      styleEl.textContent = style;
      document.head.appendChild(styleEl);
    }

    app.mount(container);

    return {
      handle: {
        unmount() {
          try { app.unmount(); } catch {}
          styleEl?.remove();
        },
      },
      error: null,
    };
  } catch (err) {
    return {
      handle: { unmount() {} },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
