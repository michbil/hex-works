/**
 * Utility functions for hex editor
 */

// Format byte as hex string (2 characters)
export function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

// Format address as hex string (8 characters by default)
export function addressToHex(address: number, width: number = 8): string {
  return address.toString(16).padStart(width, '0').toUpperCase();
}

// Parse hex string to number
export function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

// Check if character is printable ASCII
export function isPrintableAscii(charCode: number): boolean {
  return charCode >= 0x20 && charCode < 0x7f;
}

// Convert byte to printable character or placeholder
export function byteToChar(byte: number): string {
  return isPrintableAscii(byte) ? String.fromCharCode(byte) : '.';
}

// Format file size to human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Generate array of line offsets for hex view
export function generateLineOffsets(
  totalBytes: number,
  bytesPerLine: number = 16
): number[] {
  const lines: number[] = [];
  for (let offset = 0; offset < totalBytes; offset += bytesPerLine) {
    lines.push(offset);
  }
  return lines;
}

// Calculate visible lines for virtualization
export function calculateVisibleLines(
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  totalLines: number,
  overscan: number = 5
): { startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / lineHeight);
  const endIndex = Math.min(totalLines, startIndex + visibleCount + overscan * 2);
  return { startIndex, endIndex };
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Deep clone object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Search for byte pattern in buffer
export function searchBytes(
  buffer: Uint8Array,
  pattern: Uint8Array,
  startOffset: number = 0
): number {
  outer: for (let i = startOffset; i <= buffer.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}

// Search for text in buffer
export function searchText(
  buffer: Uint8Array,
  text: string,
  startOffset: number = 0
): number {
  const encoder = new TextEncoder();
  const pattern = encoder.encode(text);
  return searchBytes(buffer, pattern, startOffset);
}

// Convert hex string to byte sequence
export function stringToByteSeq(buffer: string): number[] {
  const res: number[] = [];
  let data = buffer.replace(/[^0-9a-fA-F]/g, '');

  if (data.length % 2 !== 0) {
    data = '0' + data;
  }

  const byteList = data.match(/.{1,2}/g) || [];
  for (const byteStr of byteList) {
    res.push(parseInt(byteStr, 16));
  }
  return res;
}

// Convert number to hex string with specified length
export function toHex(number: number, length: number): string {
  return number.toString(16).toUpperCase().padStart(length, '0');
}

// Invert hex string (XOR with 0xFF)
export function hexInvert(s: string): string {
  if (s.length % 2 !== 0) {
    throw new Error('Non even bytes in string');
  }
  const data = s.replace(/[^0-9a-fA-F]/g, '');
  const byteList = data.match(/.{1,2}/g) || [];
  let res = '';

  for (const byteStr of byteList) {
    const val = parseInt(byteStr, 16) ^ 0xff;
    res += toHex(val, 2);
  }
  return res;
}

// Reverse byte string (swap byte order)
export function reverseByteString(s: string): string {
  if (s.length % 2 !== 0) {
    throw new Error('Non even bytes in string');
  }
  let res = '';
  for (let i = 0; i < s.length; i += 2) {
    res = s[s.length - 2 - i] + s[s.length - 1 - i] + res;
  }
  return res;
}

// Align string to specified length with leading zeros
export function alignToLength(str: string, length: number): string {
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}

// Convert number to character (printable or dot)
export function toChar(number: number): string {
  if (number > 127) return '.';
  return number <= 32 ? '.' : String.fromCharCode(number);
}

// Generate UUID
export function generateUUID(): string {
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
