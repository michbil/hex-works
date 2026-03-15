import { BinaryBuffer } from '../binbuf';

describe('BinaryBuffer constructor', () => {
  it('creates empty buffer with no args', () => {
    const buf = new BinaryBuffer();
    expect(buf.length).toBe(0);
  });

  it('creates buffer of specified length from number', () => {
    const buf = new BinaryBuffer(16);
    expect(buf.length).toBe(16);
    expect(buf.getByte(0)).toBe(0);
  });

  it('creates buffer from Uint8Array', () => {
    const buf = new BinaryBuffer(new Uint8Array([0xde, 0xad]));
    expect(buf.length).toBe(2);
    expect(buf.getByte(0)).toBe(0xde);
    expect(buf.getByte(1)).toBe(0xad);
  });

  it('creates buffer from ArrayBuffer', () => {
    const ab = new Uint8Array([0xca, 0xfe]).buffer;
    const buf = new BinaryBuffer(ab);
    expect(buf.length).toBe(2);
    expect(buf.getByte(0)).toBe(0xca);
  });

  it('creates buffer from number array', () => {
    const buf = new BinaryBuffer([1, 2, 3]);
    expect(buf.length).toBe(3);
    expect(buf.getByte(2)).toBe(3);
  });

  it('initializes navigation state to defaults', () => {
    const buf = new BinaryBuffer(8);
    expect(buf.offset).toBe(0);
    expect(buf.current).toBe(0);
    expect(buf.nibble).toBe(0);
    expect(buf.selectionStart).toBe(-1);
    expect(buf.selectionEnd).toBe(-1);
  });

  it('initializes name and changed', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.name).toBe('unnamed');
    expect(buf.changed).toBe(false);
  });
});

describe('getByte / setByte', () => {
  it('getByte returns correct value', () => {
    const buf = new BinaryBuffer([0x41, 0x42]);
    expect(buf.getByte(0)).toBe(0x41);
    expect(buf.getByte(1)).toBe(0x42);
  });

  it('getByte throws RangeError for negative offset', () => {
    const buf = new BinaryBuffer(4);
    expect(() => buf.getByte(-1)).toThrow(RangeError);
  });

  it('getByte throws RangeError for offset >= length', () => {
    const buf = new BinaryBuffer(4);
    expect(() => buf.getByte(4)).toThrow(RangeError);
  });

  it('setByte sets value and masks to 0xFF', () => {
    const buf = new BinaryBuffer(4);
    buf.setByte(0, 0x1ff);
    expect(buf.getByte(0)).toBe(0xff);
  });

  it('setByte marks byte as modified', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.isMarked(0)).toBe(false);
    buf.setByte(0, 0x42);
    expect(buf.isMarked(0)).toBe(true);
  });

  it('setByte sets changed flag', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.changed).toBe(false);
    buf.setByte(0, 1);
    expect(buf.changed).toBe(true);
  });

  it('setByte throws RangeError for out-of-bounds', () => {
    const buf = new BinaryBuffer(4);
    expect(() => buf.setByte(-1, 0)).toThrow(RangeError);
    expect(() => buf.setByte(4, 0)).toThrow(RangeError);
  });
});

describe('getBytes / setBytes', () => {
  it('getBytes returns a slice of the buffer', () => {
    const buf = new BinaryBuffer([10, 20, 30, 40]);
    const bytes = buf.getBytes(1, 2);
    expect(Array.from(bytes)).toEqual([20, 30]);
  });

  it('setBytes writes bytes at offset', () => {
    const buf = new BinaryBuffer(4);
    buf.setBytes(1, [0xaa, 0xbb]);
    expect(buf.getByte(1)).toBe(0xaa);
    expect(buf.getByte(2)).toBe(0xbb);
  });
});

describe('color management', () => {
  it('getColor returns 0 for out-of-bounds', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.getColor(-1)).toBe(0);
    expect(buf.getColor(99)).toBe(0);
  });

  it('setColor sets and retrieves color value', () => {
    const buf = new BinaryBuffer(4);
    buf.setColor(0, 3);
    expect(buf.getColor(0)).toBe(3);
  });

  it('setColor is no-op for out-of-bounds', () => {
    const buf = new BinaryBuffer(4);
    buf.setColor(-1, 1); // should not throw
    buf.setColor(99, 1); // should not throw
    expect(buf.getColor(0)).toBe(0);
  });

  it('getColoredRegion returns undefined for uncolored byte', () => {
    const buf = new BinaryBuffer(8);
    expect(buf.getColoredRegion(0)).toBeUndefined();
  });

  it('getColoredRegion finds contiguous same-color region', () => {
    const buf = new BinaryBuffer(8);
    buf.setColor(2, 1);
    buf.setColor(3, 1);
    buf.setColor(4, 1);
    const region = buf.getColoredRegion(3);
    expect(region).toEqual({ start: 2, end: 4 });
  });

  it('getColoredRegion stops at color boundary', () => {
    const buf = new BinaryBuffer(8);
    buf.setColor(0, 1);
    buf.setColor(1, 1);
    buf.setColor(2, 2);
    const region = buf.getColoredRegion(0);
    expect(region).toEqual({ start: 0, end: 1 });
  });
});

describe('markers', () => {
  it('isMarked returns false for out-of-bounds', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.isMarked(-1)).toBe(false);
    expect(buf.isMarked(99)).toBe(false);
  });

  it('clearMarkers resets all marks', () => {
    const buf = new BinaryBuffer(4);
    buf.setByte(0, 1);
    buf.setByte(1, 2);
    expect(buf.isMarked(0)).toBe(true);
    buf.clearMarkers();
    expect(buf.isMarked(0)).toBe(false);
    expect(buf.isMarked(1)).toBe(false);
  });
});

describe('selection', () => {
  it('selectRange normalizes start > end', () => {
    const buf = new BinaryBuffer(8);
    buf.selectRange(5, 2);
    expect(buf.selectionStart).toBe(2);
    expect(buf.selectionEnd).toBe(5);
  });

  it('isSelected returns true within range', () => {
    const buf = new BinaryBuffer(8);
    buf.selectRange(2, 5);
    expect(buf.isSelected(3)).toBe(true);
    expect(buf.isSelected(2)).toBe(true);
    expect(buf.isSelected(5)).toBe(true);
  });

  it('isSelected returns false outside range', () => {
    const buf = new BinaryBuffer(8);
    buf.selectRange(2, 5);
    expect(buf.isSelected(1)).toBe(false);
    expect(buf.isSelected(6)).toBe(false);
  });

  it('isSelected returns false when no selection', () => {
    const buf = new BinaryBuffer(8);
    expect(buf.isSelected(0)).toBe(false);
  });

  it('getSelection returns hex string for selected range', () => {
    const buf = new BinaryBuffer([0x0a, 0x0b, 0x0c, 0x0d]);
    buf.selectRange(1, 2);
    expect(buf.getSelection()).toBe('0B 0C');
  });

  it('getSelection returns empty string when no selection', () => {
    const buf = new BinaryBuffer(4);
    expect(buf.getSelection()).toBe('');
  });
});

describe('compareToBuffer', () => {
  it('marks differing bytes in target buffer', () => {
    const source = new BinaryBuffer([1, 2, 3, 4]);
    const target = new BinaryBuffer([1, 9, 3, 9]);
    source.compareToBuffer(target);
    expect(target.isMarked(0)).toBe(false);
    expect(target.isMarked(1)).toBe(true);
    expect(target.isMarked(2)).toBe(false);
    expect(target.isMarked(3)).toBe(true);
  });
});

describe('swapBytes', () => {
  it('swaps adjacent bytes pairwise', () => {
    const buf = new BinaryBuffer([0x01, 0x02, 0x03, 0x04]);
    buf.swapBytes();
    expect(buf.getByte(0)).toBe(0x02);
    expect(buf.getByte(1)).toBe(0x01);
    expect(buf.getByte(2)).toBe(0x04);
    expect(buf.getByte(3)).toBe(0x03);
  });

  it('handles odd-length buffer (ignores last byte)', () => {
    const buf = new BinaryBuffer([0x01, 0x02, 0x03]);
    buf.swapBytes();
    expect(buf.getByte(0)).toBe(0x02);
    expect(buf.getByte(1)).toBe(0x01);
    expect(buf.getByte(2)).toBe(0x03);
  });

  it('does not mark bytes that are already equal', () => {
    const buf = new BinaryBuffer([0xaa, 0xaa]);
    buf.swapBytes();
    expect(buf.isMarked(0)).toBe(false);
    expect(buf.isMarked(1)).toBe(false);
  });
});

describe('pasteSequence', () => {
  it('pastes hex string at position and returns count', () => {
    const buf = new BinaryBuffer(4);
    const n = buf.pasteSequence('AABB', 0);
    expect(n).toBe(2);
    expect(buf.getByte(0)).toBe(0xaa);
    expect(buf.getByte(1)).toBe(0xbb);
  });

  it('handles non-hex characters in input', () => {
    const buf = new BinaryBuffer(4);
    const n = buf.pasteSequence('AA BB CC', 0);
    expect(n).toBe(3);
    expect(buf.getByte(0)).toBe(0xaa);
    expect(buf.getByte(1)).toBe(0xbb);
    expect(buf.getByte(2)).toBe(0xcc);
  });

  it('stops at end of buffer', () => {
    const buf = new BinaryBuffer(2);
    const n = buf.pasteSequence('AABBCCDD', 0);
    expect(n).toBe(2);
  });
});

describe('fillWithSequence', () => {
  it('fills range with repeating sequence', () => {
    const buf = new BinaryBuffer(6);
    buf.fillWithSequence(0, 5, [0xaa, 0xbb]);
    expect(buf.getByte(0)).toBe(0xaa);
    expect(buf.getByte(1)).toBe(0xbb);
    expect(buf.getByte(2)).toBe(0xaa);
    expect(buf.getByte(3)).toBe(0xbb);
    expect(buf.getByte(4)).toBe(0xaa);
    expect(buf.getByte(5)).toBe(0xbb);
  });

  it('XOR mode XORs with existing data', () => {
    const buf = new BinaryBuffer([0xff, 0x00, 0xff]);
    buf.fillWithSequence(0, 2, [0xff], true);
    expect(buf.getByte(0)).toBe(0x00);
    expect(buf.getByte(1)).toBe(0xff);
    expect(buf.getByte(2)).toBe(0x00);
  });

  it('no-op for empty sequence', () => {
    const buf = new BinaryBuffer([0x01]);
    buf.fillWithSequence(0, 0, []);
    expect(buf.getByte(0)).toBe(0x01);
  });
});

describe('multi-byte reads', () => {
  const buf = new BinaryBuffer([0x01, 0x02, 0x03, 0x04]);

  it('getUint16LE reads little-endian 16-bit', () => {
    expect(buf.getUint16LE(0)).toBe(0x0201);
  });

  it('getUint16BE reads big-endian 16-bit', () => {
    expect(buf.getUint16BE(0)).toBe(0x0102);
  });

  it('getUint32LE reads little-endian 32-bit', () => {
    expect(buf.getUint32LE(0)).toBe(0x04030201);
  });

  it('getUint32BE reads big-endian 32-bit', () => {
    expect(buf.getUint32BE(0)).toBe(0x01020304);
  });
});

describe('toHexString / fromHexString', () => {
  it('toHexString produces lowercase hex', () => {
    const buf = new BinaryBuffer([0xca, 0xfe]);
    expect(buf.toHexString()).toBe('cafe');
  });

  it('toHexString with offset and length', () => {
    const buf = new BinaryBuffer([0x00, 0xab, 0xcd, 0x00]);
    expect(buf.toHexString(1, 2)).toBe('abcd');
  });

  it('fromHexString round-trips correctly', () => {
    const original = new BinaryBuffer([0xde, 0xad, 0xbe, 0xef]);
    const hex = original.toHexString();
    const restored = BinaryBuffer.fromHexString(hex);
    expect(restored.toHexString()).toBe(hex);
  });

  it('toAsciiString replaces non-printable with dots', () => {
    const buf = new BinaryBuffer([0x48, 0x69, 0x01, 0x7f]);
    expect(buf.toAsciiString()).toBe('Hi..');
  });
});

describe('toBuffer / fromBuffer', () => {
  it('toBuffer produces uppercase hex', () => {
    const buf = new BinaryBuffer([0xab, 0xcd]);
    expect(buf.toBuffer()).toBe('ABCD');
  });

  it('fromBuffer loads hex data into existing buffer', () => {
    const buf = new BinaryBuffer(2);
    buf.fromBuffer('CAFE');
    expect(buf.getByte(0)).toBe(0xca);
    expect(buf.getByte(1)).toBe(0xfe);
  });
});

describe('resize', () => {
  it('preserves existing data when growing', () => {
    const buf = new BinaryBuffer([0x01, 0x02]);
    buf.resize(4);
    expect(buf.length).toBe(4);
    expect(buf.getByte(0)).toBe(0x01);
    expect(buf.getByte(1)).toBe(0x02);
    expect(buf.getByte(2)).toBe(0x00);
  });

  it('truncates when shrinking', () => {
    const buf = new BinaryBuffer([0x01, 0x02, 0x03, 0x04]);
    buf.resize(2);
    expect(buf.length).toBe(2);
    expect(buf.getByte(0)).toBe(0x01);
    expect(buf.getByte(1)).toBe(0x02);
  });

  it('preserves colors', () => {
    const buf = new BinaryBuffer(4);
    buf.setColor(0, 3);
    buf.resize(8);
    expect(buf.getColor(0)).toBe(3);
  });
});

describe('insert / delete', () => {
  it('insert shifts data right and marks inserted bytes', () => {
    const buf = new BinaryBuffer([0x01, 0x02, 0x03]);
    buf.insert(1, [0xaa, 0xbb]);
    expect(buf.length).toBe(5);
    expect(buf.getByte(0)).toBe(0x01);
    expect(buf.getByte(1)).toBe(0xaa);
    expect(buf.getByte(2)).toBe(0xbb);
    expect(buf.getByte(3)).toBe(0x02);
    expect(buf.getByte(4)).toBe(0x03);
    expect(buf.isMarked(1)).toBe(true);
    expect(buf.isMarked(2)).toBe(true);
  });

  it('delete removes bytes and shifts data left', () => {
    const buf = new BinaryBuffer([0x01, 0x02, 0x03, 0x04]);
    buf.delete(1, 2);
    expect(buf.length).toBe(2);
    expect(buf.getByte(0)).toBe(0x01);
    expect(buf.getByte(1)).toBe(0x04);
  });
});

describe('clone', () => {
  it('produces an independent copy', () => {
    const buf = new BinaryBuffer([0x01, 0x02]);
    const cloned = buf.clone();
    cloned.setByte(0, 0xff);
    expect(buf.getByte(0)).toBe(0x01);
    expect(cloned.getByte(0)).toBe(0xff);
  });

  it('preserves data, colors, marked, and name', () => {
    const buf = new BinaryBuffer([0xaa, 0xbb]);
    buf.setColor(0, 5);
    buf.setByte(0, 0xaa); // marks byte 0
    buf.name = 'test';
    const cloned = buf.clone();
    expect(cloned.getByte(0)).toBe(0xaa);
    expect(cloned.getColor(0)).toBe(5);
    expect(cloned.isMarked(0)).toBe(true);
    expect(cloned.name).toBe('test');
  });

  it('resets changed to false', () => {
    const buf = new BinaryBuffer(4);
    buf.setByte(0, 1);
    expect(buf.changed).toBe(true);
    const cloned = buf.clone();
    expect(cloned.changed).toBe(false);
  });
});

describe('serialization', () => {
  it('saveToDict produces correct format', () => {
    const buf = new BinaryBuffer([0xca, 0xfe]);
    buf.name = 'test.bin';
    const dict = buf.saveToDict();
    expect(dict.name).toBe('test.bin');
    expect(dict.uuid).toBe(buf.uuid);
    expect(dict.data).toBe('CAFE');
    expect(dict.colors).toBeInstanceOf(Uint8Array);
  });

  it('saveToDict resets changed flag', () => {
    const buf = new BinaryBuffer(4);
    buf.setByte(0, 1);
    expect(buf.changed).toBe(true);
    buf.saveToDict();
    expect(buf.changed).toBe(false);
  });

  it('loadFromLocalStorage restores data, colors, uuid', () => {
    const buf = new BinaryBuffer(2);
    const result = buf.loadFromLocalStorage({
      data: 'CAFE',
      colors: new Uint8Array([1, 2]),
      uuid: 'test-uuid',
    });
    expect(result).toBe(true);
    expect(buf.getByte(0)).toBe(0xca);
    expect(buf.getByte(1)).toBe(0xfe);
    expect(buf.getColor(0)).toBe(1);
    expect(buf.uuid).toBe('test-uuid');
  });

  it('loadFromLocalStorage returns false for empty data', () => {
    const buf = new BinaryBuffer(2);
    const result = buf.loadFromLocalStorage({ data: '' });
    expect(result).toBe(false);
  });
});

describe('name accessors', () => {
  it('setName / getName work', () => {
    const buf = new BinaryBuffer(4);
    buf.setName('myfile.bin');
    expect(buf.getName()).toBe('myfile.bin');
    expect(buf.name).toBe('myfile.bin');
  });
});
