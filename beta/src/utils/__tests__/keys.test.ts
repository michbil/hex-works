import { Keys, isHexDigit, isNavigationKey, keyToHexValue } from '../keys';

describe('isHexDigit', () => {
  it('returns true for digits 0-9', () => {
    for (const d of '0123456789') {
      expect(isHexDigit(d)).toBe(true);
    }
  });

  it('returns true for a-f lowercase', () => {
    for (const d of 'abcdef') {
      expect(isHexDigit(d)).toBe(true);
    }
  });

  it('returns true for A-F uppercase', () => {
    for (const d of 'ABCDEF') {
      expect(isHexDigit(d)).toBe(true);
    }
  });

  it('returns false for non-hex characters', () => {
    expect(isHexDigit('g')).toBe(false);
    expect(isHexDigit('z')).toBe(false);
    expect(isHexDigit(' ')).toBe(false);
    expect(isHexDigit('!')).toBe(false);
  });
});

describe('isNavigationKey', () => {
  it('returns true for all navigation keys', () => {
    const navKeys = [
      Keys.LEFT, Keys.RIGHT, Keys.UP, Keys.DOWN,
      Keys.HOME, Keys.END, Keys.PAGE_UP, Keys.PAGE_DOWN,
    ];
    for (const key of navKeys) {
      expect(isNavigationKey(key)).toBe(true);
    }
  });

  it('returns false for non-navigation keys', () => {
    expect(isNavigationKey('a')).toBe(false);
    expect(isNavigationKey('1')).toBe(false);
    expect(isNavigationKey('Enter')).toBe(false);
  });
});

describe('keyToHexValue', () => {
  it('returns numeric value for hex digits', () => {
    expect(keyToHexValue('0')).toBe(0);
    expect(keyToHexValue('9')).toBe(9);
    expect(keyToHexValue('a')).toBe(10);
    expect(keyToHexValue('f')).toBe(15);
    expect(keyToHexValue('A')).toBe(10);
    expect(keyToHexValue('F')).toBe(15);
  });

  it('returns null for non-hex key', () => {
    expect(keyToHexValue('g')).toBeNull();
    expect(keyToHexValue('z')).toBeNull();
    expect(keyToHexValue(' ')).toBeNull();
  });
});
