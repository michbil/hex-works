/**
 * Binary Buffer utilities for hex editing
 * Ported from original AngularJS hex-works app
 */

// Generate a UUID
function generateUUID(): string {
  const d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class BinaryBuffer {
  private data: Uint8Array;
  private colors: Uint8Array;
  private marked: Uint8Array;
  private _name: string;
  private _uuid: string;
  private _changed: boolean;

  // Cursor/navigation state
  public offset: number;
  public current: number;
  public nibble: number;

  // Selection state
  public selectionStart: number;
  public selectionEnd: number;

  constructor(data?: ArrayBuffer | Uint8Array | number[] | number) {
    if (typeof data === 'number') {
      // Create buffer of specified length
      this.data = new Uint8Array(data);
    } else if (data instanceof ArrayBuffer) {
      this.data = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      this.data = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      this.data = new Uint8Array(data);
    } else {
      this.data = new Uint8Array(0);
    }

    // Initialize metadata arrays
    this.colors = new Uint8Array(this.data.length);
    this.marked = new Uint8Array(this.data.length);

    // Initialize properties
    this._name = 'unnamed';
    this._uuid = generateUUID();
    this._changed = false;

    // Navigation state
    this.offset = 0;
    this.current = 0;
    this.nibble = 0;

    // Selection state
    this.selectionStart = -1;
    this.selectionEnd = -1;
  }

  get length(): number {
    return this.data.length;
  }

  get buffer(): Uint8Array {
    return this.data;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get uuid(): string {
    return this._uuid;
  }

  get changed(): boolean {
    return this._changed;
  }

  set changed(value: boolean) {
    this._changed = value;
  }

  setName(name: string): void {
    this._name = name;
  }

  getName(): string {
    return this._name;
  }

  getByte(offset: number): number {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of bounds`);
    }
    return this.data[offset];
  }

  setByte(offset: number, value: number): void {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of bounds`);
    }
    this.data[offset] = value & 0xff;
    this.marked[offset] = 1;
    this._changed = true;
  }

  // Color management
  getColor(offset: number): number {
    if (offset < 0 || offset >= this.colors.length) {
      return 0;
    }
    return this.colors[offset];
  }

  setColor(offset: number, color: number): void {
    if (offset >= 0 && offset < this.colors.length) {
      this.colors[offset] = color;
      this._changed = true;
    }
  }

  // Marked (modified) state
  isMarked(offset: number): boolean {
    if (offset < 0 || offset >= this.marked.length) {
      return false;
    }
    return this.marked[offset] === 1;
  }

  clearMarkers(): void {
    this.marked.fill(0);
  }

  // Selection management
  selectRange(start: number, end: number): void {
    if (start > end) {
      [start, end] = [end, start];
    }
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  isSelected(index: number): boolean {
    if (this.selectionStart < 0 || this.selectionEnd < 0) {
      return false;
    }
    return index >= this.selectionStart && index <= this.selectionEnd;
  }

  getSelection(): string {
    if (this.selectionStart < 0 || this.selectionEnd < 0) {
      return '';
    }
    let out = '';
    for (let i = this.selectionStart; i <= this.selectionEnd; i++) {
      out += this.toHex(this.data[i], 2) + ' ';
    }
    return out.trim();
  }

  // Get colored region extent at address
  getColoredRegion(adr: number): { start: number; end: number } | undefined {
    const color = this.colors[adr];
    if (color === 0) {
      return undefined;
    }

    let startadr = adr;
    let endadr = adr;

    for (let i = adr; i < this.data.length; i++) {
      if (this.colors[i] !== color) break;
      endadr = i;
    }

    for (let i = adr; i >= 0; i--) {
      if (this.colors[i] !== color) break;
      startadr = i;
    }

    return { start: startadr, end: endadr };
  }

  // Compare to another buffer and mark differences
  compareToBuffer(target: BinaryBuffer): void {
    for (let i = 0; i < this.data.length; i++) {
      const targ = target.data[i];
      if (typeof targ !== 'undefined' && this.data[i] !== targ) {
        target.marked[i] = 1;
      }
    }
  }

  /**
   * Compare multiple buffers and return per-byte change counts as a typed array.
   * changeCounts[i] = number of buffers that differ from buffer[0] at offset i.
   */
  static compareMultipleFast(
    buffers: BinaryBuffer[],
  ): { changeCounts: Uint16Array; maxChanges: number } {
    if (buffers.length === 0) return { changeCounts: new Uint16Array(0), maxChanges: 0 };
    let maxLen = 0;
    for (let b = 0; b < buffers.length; b++) {
      if (buffers[b].length > maxLen) maxLen = buffers[b].length;
    }
    const changeCounts = new Uint16Array(maxLen);
    let maxChanges = 0;
    const firstData = buffers[0].data;
    const firstLen = firstData.length;

    for (let i = 0; i < maxLen; i++) {
      const firstVal = i < firstLen ? firstData[i] : -1;
      let count = 0;
      for (let b = 1; b < buffers.length; b++) {
        const val = i < buffers[b].length ? buffers[b].data[i] : -1;
        if (val !== firstVal) count++;
      }
      changeCounts[i] = count;
      if (count > maxChanges) maxChanges = count;
    }
    return { changeCounts, maxChanges };
  }

  /**
   * Compare multiple buffers and produce per-address statistics (detailed).
   * Used by the heatmap panel for the detail inspector.
   * Only call this for specific offsets, not the entire buffer.
   */
  static compareAtOffset(
    buffers: BinaryBuffer[],
    offset: number,
  ): { uniqueValues: number; min: number; max: number; values: number[]; changeCount: number } {
    let min = 0xff;
    let max = 0x00;
    const seen = new Uint8Array(256); // bitset for byte values
    let uniqueCount = 0;
    const values: number[] = new Array(buffers.length);
    let changeCount = 0;
    const firstVal = offset < buffers[0].length ? buffers[0].data[offset] : -1;

    for (let b = 0; b < buffers.length; b++) {
      const val = offset < buffers[b].length ? buffers[b].data[offset] : -1;
      values[b] = val;
      if (val >= 0) {
        if (seen[val] === 0) { seen[val] = 1; uniqueCount++; }
        if (val < min) min = val;
        if (val > max) max = val;
        if (b > 0 && val !== firstVal) changeCount++;
      }
    }
    return { uniqueValues: uniqueCount, min, max, values, changeCount };
  }

  // Swap adjacent bytes
  swapBytes(): void {
    let len = this.data.length;
    if (len % 2 !== 0) len--;

    for (let i = 0; i < len; i += 2) {
      const t = this.data[i];
      this.data[i] = this.data[i + 1];
      this.data[i + 1] = t;
      this.marked[i] = 1;
      this.marked[i + 1] = 1;

      if (this.data[i] === this.data[i + 1]) {
        this.marked[i] = 0;
        this.marked[i + 1] = 0;
      }
    }
    this._changed = true;
  }

  // Paste hex sequence at position
  pasteSequence(hexData: string, pos: number): number {
    const cleanData = hexData.replace(/[^0-9a-fA-F]/g, '');
    const byteList = cleanData.match(/.{1,2}/g) || [];
    let n = 0;

    for (const byteStr of byteList) {
      if (pos >= this.data.length) break;
      this.setByte(pos++, parseInt(byteStr, 16));
      n++;
    }

    return n;
  }

  // Fill range with sequence, optionally XOR
  fillWithSequence(start: number, end: number, sequence: number[], xor: boolean = false): void {
    if (sequence.length === 0) return;

    let seqPos = 0;
    for (let i = start; i <= end && i < this.data.length; i++) {
      let sval = sequence[seqPos++];
      if (seqPos >= sequence.length) seqPos = 0;

      if (xor) {
        sval = (this.data[i] ^ sval) & 0xff;
      }
      this.setByte(i, sval);
    }
  }

  // Helper method for hex formatting
  private toHex(value: number, length: number): string {
    return value.toString(16).toUpperCase().padStart(length, '0');
  }

  getBytes(offset: number, length: number): Uint8Array {
    return this.data.slice(offset, offset + length);
  }

  setBytes(offset: number, bytes: Uint8Array | number[]): void {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length && offset + i < this.data.length; i++) {
      this.data[offset + i] = arr[i];
    }
  }

  // Read multi-byte values (little-endian)
  getUint16LE(offset: number): number {
    return this.data[offset] | (this.data[offset + 1] << 8);
  }

  getUint32LE(offset: number): number {
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  // Read multi-byte values (big-endian)
  getUint16BE(offset: number): number {
    return (this.data[offset] << 8) | this.data[offset + 1];
  }

  getUint32BE(offset: number): number {
    return (
      ((this.data[offset] << 24) |
        (this.data[offset + 1] << 16) |
        (this.data[offset + 2] << 8) |
        this.data[offset + 3]) >>> 0
    );
  }

  // Convert to hex string
  toHexString(offset: number = 0, length?: number): string {
    const table = BinaryBuffer.HEX_TABLE_LOWER;
    const len = length ?? this.data.length - offset;
    const end = Math.min(offset + len, this.data.length);
    const parts = new Array<string>(end - offset);
    for (let i = offset; i < end; i++) {
      parts[i - offset] = table[this.data[i]];
    }
    return parts.join('');
  }

  // Convert to ASCII string (printable characters only)
  toAsciiString(offset: number = 0, length?: number): string {
    const len = length ?? this.data.length - offset;
    let result = '';
    for (let i = 0; i < len && offset + i < this.data.length; i++) {
      const byte = this.data[offset + i];
      result += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.';
    }
    return result;
  }

  // Create from hex string
  static fromHexString(hex: string): BinaryBuffer {
    const cleanHex = hex.replace(/\s/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return new BinaryBuffer(bytes);
  }

  // Resize buffer
  resize(newLength: number): void {
    const newData = new Uint8Array(newLength);
    const newColors = new Uint8Array(newLength);
    const newMarked = new Uint8Array(newLength);

    newData.set(this.data.slice(0, Math.min(this.data.length, newLength)));
    newColors.set(this.colors.slice(0, Math.min(this.colors.length, newLength)));
    newMarked.set(this.marked.slice(0, Math.min(this.marked.length, newLength)));

    this.data = newData;
    this.colors = newColors;
    this.marked = newMarked;
    this._changed = true;
  }

  // Insert bytes at position
  insert(offset: number, bytes: Uint8Array | number[]): void {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const newData = new Uint8Array(this.data.length + arr.length);
    const newColors = new Uint8Array(this.colors.length + arr.length);
    const newMarked = new Uint8Array(this.marked.length + arr.length);

    newData.set(this.data.slice(0, offset));
    newData.set(arr, offset);
    newData.set(this.data.slice(offset), offset + arr.length);

    newColors.set(this.colors.slice(0, offset));
    newColors.set(this.colors.slice(offset), offset + arr.length);

    newMarked.set(this.marked.slice(0, offset));
    newMarked.fill(1, offset, offset + arr.length); // Mark inserted bytes
    newMarked.set(this.marked.slice(offset), offset + arr.length);

    this.data = newData;
    this.colors = newColors;
    this.marked = newMarked;
    this._changed = true;
  }

  // Delete bytes at position
  delete(offset: number, length: number): void {
    const newData = new Uint8Array(this.data.length - length);
    const newColors = new Uint8Array(this.colors.length - length);
    const newMarked = new Uint8Array(this.marked.length - length);

    newData.set(this.data.slice(0, offset));
    newData.set(this.data.slice(offset + length), offset);

    newColors.set(this.colors.slice(0, offset));
    newColors.set(this.colors.slice(offset + length), offset);

    newMarked.set(this.marked.slice(0, offset));
    newMarked.set(this.marked.slice(offset + length), offset);

    this.data = newData;
    this.colors = newColors;
    this.marked = newMarked;
    this._changed = true;
  }

  // Clone the buffer
  clone(): BinaryBuffer {
    const cloned = new BinaryBuffer(new Uint8Array(this.data));
    cloned.colors.set(this.colors);
    cloned.marked.set(this.marked);
    cloned._name = this._name;
    cloned._changed = false;
    return cloned;
  }

  // Serialize to dictionary (for storage)
  saveToDict(): { name: string; colors: Uint8Array; data: string; uuid: string } {
    this._changed = false;
    return {
      name: this._name,
      colors: this.colors,
      data: this.toBuffer(),
      uuid: this._uuid,
    };
  }

  // Convert buffer to hex string
  private static HEX_TABLE_UPPER: string[] = (() => {
    const chars = '0123456789ABCDEF';
    const table = new Array<string>(256);
    for (let i = 0; i < 256; i++) {
      table[i] = chars[i >> 4] + chars[i & 0x0f];
    }
    return table;
  })();
  private static HEX_TABLE_LOWER: string[] = (() => {
    const chars = '0123456789abcdef';
    const table = new Array<string>(256);
    for (let i = 0; i < 256; i++) {
      table[i] = chars[i >> 4] + chars[i & 0x0f];
    }
    return table;
  })();

  toBuffer(): string {
    const table = BinaryBuffer.HEX_TABLE_UPPER;
    const parts = new Array<string>(this.data.length);
    for (let i = 0; i < this.data.length; i++) {
      parts[i] = table[this.data[i]];
    }
    return parts.join('');
  }

  // Load from hex string
  fromBuffer(buffer: string): void {
    if (typeof buffer === 'string') {
      const data = buffer.replace(/[^0-9a-fA-F]/g, '');
      const byteList = data.match(/.{1,2}/g) || [];

      for (let i = 0; i < byteList.length && i < this.data.length; i++) {
        const intVal = parseInt(byteList[i], 16);
        if (this.data[i] !== intVal) {
          this.setByte(i, intVal);
        }
      }
    }
  }

  // Load from local storage format
  loadFromLocalStorage(data: { data: string; colors?: Uint8Array; uuid?: string }): boolean {
    if (data.data) {
      this.unpackLS(data.data);
      this.marked = new Uint8Array(this.data.length);

      if (data.colors) {
        this.colors = new Uint8Array(data.colors);
      } else {
        this.colors = new Uint8Array(this.data.length);
      }

      if (data.uuid) {
        this._uuid = data.uuid;
      }
      return true;
    }
    return false;
  }

  // Deserialize buffer from hex string
  private unpackLS(buffer: string): void {
    if (typeof buffer === 'string') {
      this.data = new Uint8Array(buffer.length / 2);
      let j = 0;
      for (let i = 0; i < buffer.length; i += 2) {
        this.data[j++] = parseInt(buffer[i] + buffer[i + 1], 16) & 0xff;
      }
    }
  }
}

export default BinaryBuffer;
