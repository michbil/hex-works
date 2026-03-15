import {
  byteToHex,
  addressToHex,
  hexToNumber,
  isPrintableAscii,
  byteToChar,
  formatFileSize,
  clamp,
  generateLineOffsets,
  calculateVisibleLines,
  searchBytes,
  searchText,
  stringToByteSeq,
  toHex,
  hexInvert,
  reverseByteString,
  alignToLength,
  toChar,
  debounce,
  throttle,
  deepClone,
  generateUUID,
} from '../helpers';

describe('byteToHex', () => {
  it('formats 0 as "00"', () => expect(byteToHex(0)).toBe('00'));
  it('formats 255 as "FF"', () => expect(byteToHex(255)).toBe('FF'));
  it('formats 10 as "0A"', () => expect(byteToHex(10)).toBe('0A'));
});

describe('addressToHex', () => {
  it('formats with default width 8', () => {
    expect(addressToHex(256)).toBe('00000100');
  });
  it('formats with custom width', () => {
    expect(addressToHex(255, 4)).toBe('00FF');
  });
});

describe('hexToNumber', () => {
  it('parses hex string to number', () => {
    expect(hexToNumber('FF')).toBe(255);
    expect(hexToNumber('10')).toBe(16);
  });
});

describe('isPrintableAscii / byteToChar', () => {
  it('0x20 (space) is printable', () => expect(isPrintableAscii(0x20)).toBe(true));
  it('0x7E (~) is printable', () => expect(isPrintableAscii(0x7e)).toBe(true));
  it('0x7F is not printable', () => expect(isPrintableAscii(0x7f)).toBe(false));
  it('0x00 is not printable', () => expect(isPrintableAscii(0x00)).toBe(false));
  it('byteToChar returns character for printable', () => expect(byteToChar(0x41)).toBe('A'));
  it('byteToChar returns "." for non-printable', () => expect(byteToChar(0x01)).toBe('.'));
});

describe('formatFileSize', () => {
  it('returns "0 B" for 0', () => expect(formatFileSize(0)).toBe('0 B'));
  it('returns "1.00 KB" for 1024', () => expect(formatFileSize(1024)).toBe('1.00 KB'));
  it('returns "1.00 MB" for 1048576', () => expect(formatFileSize(1048576)).toBe('1.00 MB'));
  it('handles bytes below 1 KB', () => expect(formatFileSize(512)).toBe('512.00 B'));
});

describe('clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps above max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('passes through in-range value', () => expect(clamp(5, 0, 10)).toBe(5));
});

describe('generateLineOffsets', () => {
  it('generates offsets for given total and bytesPerLine', () => {
    expect(generateLineOffsets(48, 16)).toEqual([0, 16, 32]);
  });
  it('handles non-aligned totals', () => {
    expect(generateLineOffsets(20, 16)).toEqual([0, 16]);
  });
  it('returns empty for zero bytes', () => {
    expect(generateLineOffsets(0)).toEqual([]);
  });
});

describe('calculateVisibleLines', () => {
  it('calculates start and end indices', () => {
    const result = calculateVisibleLines(0, 200, 20, 100, 0);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
  });

  it('applies overscan', () => {
    const result = calculateVisibleLines(200, 200, 20, 100, 5);
    expect(result.startIndex).toBe(5); // floor(200/20) - 5
    expect(result.endIndex).toBe(25); // 5 + 10 + 10
  });
});

describe('searchBytes', () => {
  const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x02, 0x03]);

  it('finds pattern at start', () => {
    expect(searchBytes(buffer, new Uint8Array([0x01, 0x02]))).toBe(0);
  });

  it('finds pattern in middle', () => {
    expect(searchBytes(buffer, new Uint8Array([0x03, 0x04]))).toBe(2);
  });

  it('returns -1 when not found', () => {
    expect(searchBytes(buffer, new Uint8Array([0xff]))).toBe(-1);
  });

  it('respects startOffset', () => {
    expect(searchBytes(buffer, new Uint8Array([0x02, 0x03]), 2)).toBe(4);
  });
});

describe('searchText', () => {
  it('finds ASCII text in buffer', () => {
    const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    expect(searchText(buffer, 'llo')).toBe(2);
  });

  it('returns -1 when not found', () => {
    const buffer = new Uint8Array([0x48, 0x69]); // "Hi"
    expect(searchText(buffer, 'xyz')).toBe(-1);
  });
});

describe('stringToByteSeq', () => {
  it('parses hex string to byte array', () => {
    expect(stringToByteSeq('AABB')).toEqual([0xaa, 0xbb]);
  });

  it('handles odd-length input (pads with leading 0)', () => {
    expect(stringToByteSeq('ABC')).toEqual([0x0a, 0xbc]);
  });

  it('strips non-hex characters', () => {
    expect(stringToByteSeq('AA BB CC')).toEqual([0xaa, 0xbb, 0xcc]);
  });
});

describe('toHex', () => {
  it('formats number with specified length', () => {
    expect(toHex(255, 4)).toBe('00FF');
    expect(toHex(0, 2)).toBe('00');
  });
});

describe('hexInvert', () => {
  it('XORs each byte with 0xFF', () => {
    expect(hexInvert('00FF')).toBe('FF00');
  });

  it('throws on odd-length string', () => {
    expect(() => hexInvert('ABC')).toThrow('Non even bytes');
  });
});

describe('reverseByteString', () => {
  it('preserves byte pairs in reconstructed string', () => {
    expect(reverseByteString('0102')).toBe('0102');
    expect(reverseByteString('AABBCCDD')).toBe('AABBCCDD');
  });

  it('throws on odd-length string', () => {
    expect(() => reverseByteString('ABC')).toThrow('Non even bytes');
  });
});

describe('alignToLength', () => {
  it('pads with leading zeros', () => {
    expect(alignToLength('FF', 4)).toBe('00FF');
  });

  it('returns original if already long enough', () => {
    expect(alignToLength('FFFF', 4)).toBe('FFFF');
  });
});

describe('toChar', () => {
  it('returns character for printable ASCII', () => {
    expect(toChar(65)).toBe('A');
  });

  it('returns "." for control characters', () => {
    expect(toChar(0)).toBe('.');
    expect(toChar(32)).toBe('.');
  });

  it('returns "." for values > 127', () => {
    expect(toChar(200)).toBe('.');
  });
});

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('delays invocation', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only calls once after rapid invocations', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls immediately on first invocation', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('suppresses calls within limit window', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('deepClone', () => {
  it('produces a deep copy', () => {
    const obj = { a: { b: 1 } };
    const cloned = deepClone(obj);
    cloned.a.b = 99;
    expect(obj.a.b).toBe(1);
  });
});

describe('generateUUID', () => {
  it('returns a string matching UUID v4 pattern', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique values', () => {
    const a = generateUUID();
    const b = generateUUID();
    expect(a).not.toBe(b);
  });
});
