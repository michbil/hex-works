/**
 * Keyboard key constants
 */

export const Keys = {
  // Navigation
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',

  // Editing
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  TAB: 'Tab',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  SPACE: ' ',

  // Modifiers
  SHIFT: 'Shift',
  CTRL: 'Control',
  ALT: 'Alt',
  META: 'Meta',

  // Hex digits
  DIGIT_0: '0',
  DIGIT_1: '1',
  DIGIT_2: '2',
  DIGIT_3: '3',
  DIGIT_4: '4',
  DIGIT_5: '5',
  DIGIT_6: '6',
  DIGIT_7: '7',
  DIGIT_8: '8',
  DIGIT_9: '9',

  // Letters (for hex)
  KEY_A: 'a',
  KEY_B: 'b',
  KEY_C: 'c',
  KEY_D: 'd',
  KEY_E: 'e',
  KEY_F: 'f',
} as const;

// Check if key is a hex digit
export function isHexDigit(key: string): boolean {
  const hexKeys = '0123456789abcdefABCDEF';
  return hexKeys.includes(key);
}

// Check if key is a navigation key
export function isNavigationKey(key: string): boolean {
  const navKeys = [
    Keys.LEFT,
    Keys.RIGHT,
    Keys.UP,
    Keys.DOWN,
    Keys.HOME,
    Keys.END,
    Keys.PAGE_UP,
    Keys.PAGE_DOWN,
  ];
  return navKeys.includes(key as typeof Keys.LEFT);
}

// Convert key to hex value
export function keyToHexValue(key: string): number | null {
  if (!isHexDigit(key)) return null;
  return parseInt(key, 16);
}
