import { executeScript, executeAction, parseExports, ScriptContext } from '../script-engine';
import { BinaryBuffer } from '../../../utils/binbuf';

function makeContext(data: number[] = [0x01, 0x02, 0x03, 0x04]): ScriptContext {
  return {
    buffer: new BinaryBuffer(data),
    cursorPosition: 0,
    selection: { start: 0, end: 3 },
  };
}

describe('executeScript', () => {
  it('runs code and captures print output', () => {
    const ctx = makeContext();
    const result = executeScript('print("hello")', ctx);
    expect(result.error).toBeNull();
    expect(result.output).toContain('hello');
  });

  it('provides buffer API (getByte, setByte, length)', () => {
    const ctx = makeContext([0xaa, 0xbb]);
    const result = executeScript('print(buffer.getByte(0).toString(16))', ctx);
    expect(result.error).toBeNull();
    expect(result.output).toContain('aa');
  });

  it('can modify buffer via setByte', () => {
    const ctx = makeContext([0x00]);
    executeScript('buffer.setByte(0, 0xff)', ctx);
    expect(ctx.buffer.getByte(0)).toBe(0xff);
  });

  it('provides cursor and selection context', () => {
    const ctx = makeContext();
    ctx.cursorPosition = 5;
    ctx.selection = { start: 2, end: 10 };
    const result = executeScript('print(cursor); print(selection.start + "-" + selection.end)', ctx);
    expect(result.output[0]).toBe('5');
    expect(result.output[1]).toBe('2-10');
  });

  it('captures errors without throwing', () => {
    const ctx = makeContext();
    const result = executeScript('throw new Error("oops")', ctx);
    expect(result.error).toBe('oops');
    expect(result.exportedActions).toEqual([]);
  });

  it('reports duration', () => {
    const ctx = makeContext();
    const result = executeScript('print("hi")', ctx);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('discovers exported actions', () => {
    const ctx = makeContext();
    const result = executeScript(
      'exports.analyze = function() {}; exports.patch = function() {};',
      ctx,
    );
    expect(result.error).toBeNull();
    expect(result.exportedActions).toContain('analyze');
    expect(result.exportedActions).toContain('patch');
  });

  it('ignores non-function exports', () => {
    const ctx = makeContext();
    const result = executeScript(
      'exports.name = "test"; exports.run = function() {};',
      ctx,
    );
    expect(result.exportedActions).toEqual(['run']);
  });
});

describe('executeAction', () => {
  it('runs named exported action', () => {
    const ctx = makeContext([0x00]);
    const result = executeAction(
      'exports.fill = function() { buffer.setByte(0, 0xaa); print("filled"); };',
      'fill',
      ctx,
    );
    expect(result.error).toBeNull();
    expect(result.output).toContain('filled');
    expect(ctx.buffer.getByte(0)).toBe(0xaa);
  });

  it('returns error for non-function export', () => {
    const ctx = makeContext();
    const result = executeAction(
      'exports.name = "test";',
      'name',
      ctx,
    );
    expect(result.error).toContain('not a function');
  });

  it('returns error for missing export', () => {
    const ctx = makeContext();
    const result = executeAction('', 'missing', ctx);
    expect(result.error).toContain('not a function');
  });

  it('captures action errors', () => {
    const ctx = makeContext();
    const result = executeAction(
      'exports.boom = function() { throw new Error("kaboom"); };',
      'boom',
      ctx,
    );
    expect(result.error).toBe('kaboom');
  });
});

describe('parseExports', () => {
  it('returns exported function names', () => {
    const ctx = makeContext();
    const names = parseExports(
      'exports.a = function() {}; exports.b = function() {};',
      ctx,
    );
    expect(names).toEqual(['a', 'b']);
  });

  it('returns empty for script with errors', () => {
    const ctx = makeContext();
    const names = parseExports('throw new Error("fail")', ctx);
    expect(names).toEqual([]);
  });

  it('ignores non-function exports', () => {
    const ctx = makeContext();
    const names = parseExports(
      'exports.val = 42; exports.fn = function() {};',
      ctx,
    );
    expect(names).toEqual(['fn']);
  });
});

describe('buildApi helpers', () => {
  it('hexdump produces formatted output', () => {
    const ctx = makeContext([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const result = executeScript('hexdump(0, 16)', ctx);
    expect(result.error).toBeNull();
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.output[0]).toContain('00000000');
    expect(result.output[0]).toContain('Hello');
  });

  it('console.log routes to output', () => {
    const ctx = makeContext();
    const result = executeScript('console.log("test log")', ctx);
    expect(result.output).toContain('test log');
  });

  it('console.warn prefixes with [WARN]', () => {
    const ctx = makeContext();
    const result = executeScript('console.warn("caution")', ctx);
    expect(result.output).toContain('[WARN] caution');
  });

  it('console.error prefixes with [ERROR]', () => {
    const ctx = makeContext();
    const result = executeScript('console.error("bad")', ctx);
    expect(result.output).toContain('[ERROR] bad');
  });

  it('buffer.toHex returns hex string', () => {
    const ctx = makeContext([0xca, 0xfe]);
    const result = executeScript('print(buffer.toHex())', ctx);
    expect(result.output).toContain('cafe');
  });

  it('buffer.toAscii returns ASCII representation', () => {
    const ctx = makeContext([0x48, 0x69]);
    const result = executeScript('print(buffer.toAscii())', ctx);
    expect(result.output).toContain('Hi');
  });

  it('buffer.getBytes returns array', () => {
    const ctx = makeContext([0x01, 0x02, 0x03]);
    const result = executeScript('print(JSON.stringify(buffer.getBytes(0, 2)))', ctx);
    expect(result.output).toContain('[1,2]');
  });

  it('buffer.setBytes writes to buffer', () => {
    const ctx = makeContext([0x00, 0x00]);
    executeScript('buffer.setBytes(0, [0xaa, 0xbb])', ctx);
    expect(ctx.buffer.getByte(0)).toBe(0xaa);
    expect(ctx.buffer.getByte(1)).toBe(0xbb);
  });
});
