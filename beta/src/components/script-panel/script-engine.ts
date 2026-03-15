/**
 * Script execution engine for hex editor scripting.
 * Provides a sandboxed JavaScript environment with buffer read/write API.
 *
 * Scripts can export named actions via the `exports` object:
 *
 *   exports.analyze = function() { ... };
 *   exports.patch = function() { ... };
 *
 * These appear as individually runnable actions in the UI.
 */

import { BinaryBuffer } from '../../utils/binbuf';

export interface ScriptContext {
  buffer: BinaryBuffer;
  cursorPosition: number;
  selection: { start: number; end: number };
}

export interface ScriptResult {
  output: string[];
  error: string | null;
  duration: number;
  /** Names of exported action functions */
  exportedActions: string[];
}

/**
 * Build a scripting API object that scripts can use to interact with the buffer.
 */
function buildApi(ctx: ScriptContext, output: string[]) {
  const buf = ctx.buffer;

  return {
    buffer: {
      get length() { return buf.length; },
      getByte(offset: number): number { return buf.getByte(offset); },
      setByte(offset: number, value: number): void { buf.setByte(offset, value & 0xff); },
      getBytes(offset: number, length: number): number[] {
        return Array.from(buf.getBytes(offset, length));
      },
      setBytes(offset: number, bytes: number[]): void {
        buf.setBytes(offset, new Uint8Array(bytes.map(b => b & 0xff)));
      },
      getColor(offset: number): number { return buf.getColor(offset); },
      setColor(offset: number, color: number): void { buf.setColor(offset, color); },
      toHex(offset?: number, length?: number): string {
        return buf.toHexString(offset ?? 0, length);
      },
      toAscii(offset?: number, length?: number): string {
        return buf.toAsciiString(offset ?? 0, length);
      },
      resize(newSize: number): void { buf.resize(newSize); },
    },

    cursor: ctx.cursorPosition,

    selection: {
      start: Math.min(ctx.selection.start, ctx.selection.end),
      end: Math.max(ctx.selection.start, ctx.selection.end),
      get length() {
        return Math.abs(ctx.selection.end - ctx.selection.start);
      },
    },

    print(...args: unknown[]): void {
      output.push(args.map(a => {
        if (a instanceof Uint8Array || Array.isArray(a)) {
          return JSON.stringify(Array.from(a as ArrayLike<unknown>));
        }
        if (typeof a === 'object' && a !== null) return JSON.stringify(a);
        return String(a);
      }).join(' '));
    },

    hexdump(offset: number = 0, length: number = 256): void {
      const bytesPerLine = 16;
      const end = Math.min(offset + length, buf.length);
      for (let i = offset; i < end; i += bytesPerLine) {
        const addr = i.toString(16).padStart(8, '0');
        let hex = '';
        let ascii = '';
        for (let j = 0; j < bytesPerLine; j++) {
          if (i + j < end) {
            const b = buf.getByte(i + j);
            hex += b.toString(16).padStart(2, '0') + ' ';
            ascii += (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.';
          } else {
            hex += '   ';
            ascii += ' ';
          }
          if (j === 7) hex += ' ';
        }
        output.push(`${addr}  ${hex} |${ascii}|`);
      }
    },
  };
}

function buildConsole(api: ReturnType<typeof buildApi>, output: string[]) {
  return {
    log: (...args: unknown[]) => api.print(...args),
    warn: (...args: unknown[]) => { output.push('[WARN] ' + args.map(String).join(' ')); },
    error: (...args: unknown[]) => { output.push('[ERROR] ' + args.map(String).join(' ')); },
    info: (...args: unknown[]) => api.print(...args),
  };
}

// Cached compiled scripts: code string -> compiled Function
const compiledCache = new Map<string, Function>();

function compileScript(code: string): Function {
  let fn = compiledCache.get(code);
  if (!fn) {
    fn = new Function(
      'buffer', 'cursor', 'selection', 'print', 'hexdump', 'console', 'exports',
      code
    );
    compiledCache.set(code, fn);
    // Keep cache bounded
    if (compiledCache.size > 50) {
      const firstKey = compiledCache.keys().next().value;
      if (firstKey !== undefined) compiledCache.delete(firstKey);
    }
  }
  return fn;
}

/**
 * Execute a script's top-level code. Returns exported action names.
 */
export function executeScript(code: string, ctx: ScriptContext): ScriptResult {
  const output: string[] = [];
  const start = performance.now();

  try {
    const api = buildApi(ctx, output);
    const scriptConsole = buildConsole(api, output);
    const exports: Record<string, unknown> = {};

    const fn = compileScript(code);
    fn(api.buffer, api.cursor, api.selection, api.print, api.hexdump, scriptConsole, exports);

    const exportedActions = Object.keys(exports).filter(
      k => typeof exports[k] === 'function'
    );

    return {
      output,
      error: null,
      duration: performance.now() - start,
      exportedActions,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output,
      error: message,
      duration: performance.now() - start,
      exportedActions: [],
    };
  }
}

/**
 * Run a specific exported action from a script.
 * First evaluates the top-level code (to populate exports), then calls the named action.
 */
export function executeAction(code: string, actionName: string, ctx: ScriptContext): ScriptResult {
  const output: string[] = [];
  const start = performance.now();

  try {
    const api = buildApi(ctx, output);
    const scriptConsole = buildConsole(api, output);
    const exports: Record<string, unknown> = {};

    const fn = compileScript(code);
    fn(api.buffer, api.cursor, api.selection, api.print, api.hexdump, scriptConsole, exports);

    const action = exports[actionName];
    if (typeof action !== 'function') {
      return {
        output,
        error: `Export "${actionName}" is not a function`,
        duration: performance.now() - start,
        exportedActions: Object.keys(exports).filter(k => typeof exports[k] === 'function'),
      };
    }

    action();

    const exportedActions = Object.keys(exports).filter(
      k => typeof exports[k] === 'function'
    );

    return {
      output,
      error: null,
      duration: performance.now() - start,
      exportedActions,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output,
      error: message,
      duration: performance.now() - start,
      exportedActions: [],
    };
  }
}

/**
 * Parse a script to discover exported action names without running side effects.
 * Evaluates top-level code but discards output.
 */
export function parseExports(code: string, ctx: ScriptContext): string[] {
  try {
    const output: string[] = [];
    const api = buildApi(ctx, output);
    const scriptConsole = buildConsole(api, output);
    const exports: Record<string, unknown> = {};

    const fn = compileScript(code);
    fn(api.buffer, api.cursor, api.selection, api.print, api.hexdump, scriptConsole, exports);

    return Object.keys(exports).filter(k => typeof exports[k] === 'function');
  } catch {
    return [];
  }
}
