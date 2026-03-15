/**
 * Inspector Component - Shows byte value interpretations with bi-directional editing.
 * Editing any field writes the value back to the buffer and refreshes all other fields.
 * Ported from AngularJS hex-works app.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';

interface InspectorProps {
  width?: number;
}

// --- Utility functions (from Angular version) ---

function toHex(value: number, length: number): string {
  return value.toString(16).toUpperCase().padStart(length, '0');
}

function hexInvert(s: string): string {
  const data = s.replace(/[^0-9a-fA-F]/g, '');
  const byteList = data.match(/.{1,2}/g) || [];
  let res = '';
  for (const byteStr of byteList) {
    res += toHex(parseInt(byteStr, 16) ^ 0xff, 2);
  }
  return res;
}

function reverseByteString(s: string): string {
  if (s.length % 2 !== 0) return s;
  let res = '';
  for (let i = s.length - 2; i >= 0; i -= 2) {
    res += s[i] + s[i + 1];
  }
  return res;
}

function hexEncode(value: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s = toHex((value >> (i * 8)) & 0xff, 2) + s;
  }
  return s;
}

function alignToLength(hex: string, targetLen: number): string {
  if (hex.length >= targetLen) return hex.substring(hex.length - targetLen);
  return hex.padStart(targetLen, '0');
}

function validateHexValue(hex: string, byteCount: number): boolean {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  return clean.length > 0 && clean.length <= byteCount * 2;
}

function validateDecValue(dec: string, byteCount: number): boolean {
  const clean = dec.replace(/[^\-0-9]/g, '');
  if (clean.length === 0) return false;
  const val = parseInt(clean, 10);
  if (isNaN(val)) return false;
  const max = Math.pow(256, byteCount);
  return val >= 0 && val < max;
}

// --- Editable field types ---

type FieldId =
  | 'hexNormal' | 'hexNormalInv' | 'decNormal' | 'decNormalInv'
  | 'hexReverse' | 'hexReverseInv' | 'decReverse' | 'decReverseInv';

interface FieldState {
  value: string;
  error: boolean;
  editing: boolean;
}

type FieldStates = Record<FieldId, FieldState>;

const DEFAULT_FIELD: FieldState = { value: '', error: false, editing: false };

function makeFieldStates(): FieldStates {
  return {
    hexNormal: { ...DEFAULT_FIELD },
    hexNormalInv: { ...DEFAULT_FIELD },
    decNormal: { ...DEFAULT_FIELD },
    decNormalInv: { ...DEFAULT_FIELD },
    hexReverse: { ...DEFAULT_FIELD },
    hexReverseInv: { ...DEFAULT_FIELD },
    decReverse: { ...DEFAULT_FIELD },
    decReverseInv: { ...DEFAULT_FIELD },
  };
}

export function Inspector({}: InspectorProps) {
  const buffer = useHexEditorStore((s) => s.buffer);
  const selection = useHexEditorStore((s) => s.selection);
  const cursorPosition = useHexEditorStore((s) => s.cursorPosition);
  const renderKey = useHexEditorStore((s) => s.renderKey);
  const setModified = useHexEditorStore((s) => s.setModified);

  const [fields, setFields] = useState<FieldStates>(makeFieldStates);

  // Track which field is being edited to avoid overwriting user input
  const editingFieldRef = useRef<FieldId | null>(null);

  // Calculate selected byte range
  const selRange = (() => {
    if (!buffer) return null;
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    if (start === end) {
      return { start: cursorPosition, end: cursorPosition, count: 1 };
    }
    const clampedEnd = Math.min(end, buffer.length - 1);
    return { start, end: clampedEnd, count: clampedEnd - start + 1 };
  })();

  // Decode bytes from buffer into all field values
  const decoded = (() => {
    if (!buffer || !selRange) return null;
    const { start, end, count } = selRange;

    const bytes: number[] = [];
    for (let i = start; i <= end && i < buffer.length; i++) {
      bytes.push(buffer.getByte(i));
    }
    if (bytes.length === 0) return null;

    // Hex strings
    let hexNormal = '';
    let hexReverse = '';
    for (let i = 0; i < bytes.length; i++) {
      hexNormal += toHex(bytes[i], 2);
      hexReverse += toHex(bytes[bytes.length - 1 - i], 2);
    }

    // Numeric values (up to 8 bytes)
    let valueNormal = 0;
    let valueReverse = 0;
    const canNumeric = bytes.length <= 8;
    if (canNumeric) {
      for (let i = 0; i < bytes.length; i++) {
        valueNormal = (valueNormal << 8) | bytes[i];
        valueReverse |= bytes[i] << (i * 8);
      }
      // Ensure unsigned
      valueNormal = valueNormal >>> 0;
      valueReverse = valueReverse >>> 0;
    }

    // Checksums
    let sum8 = 0, xorSum = 0, sum16 = 0;
    for (const b of bytes) {
      sum8 = (sum8 + b) & 0xff;
      xorSum ^= b;
      sum16 = (sum16 + b) & 0xffff;
    }

    return {
      start, end, count, canNumeric,
      hexNormal,
      hexNormalInv: hexInvert(hexNormal),
      valueNormal: canNumeric ? valueNormal : 0,
      valueNormalInv: canNumeric ? parseInt(hexInvert(hexNormal), 16) : 0,
      hexReverse,
      hexReverseInv: hexInvert(hexReverse),
      valueReverse: canNumeric ? valueReverse : 0,
      valueReverseInv: canNumeric ? parseInt(hexInvert(hexReverse), 16) : 0,
      sum8: toHex(sum8, 2),
      xorSum: toHex(xorSum, 2),
      sum16: toHex(sum16, 4),
    };
  })();

  // Sync decoded values into field states (unless user is actively editing that field)
  useEffect(() => {
    if (!decoded) return;
    setFields((prev) => {
      const next = { ...prev };
      const map: Record<FieldId, string> = {
        hexNormal: decoded.hexNormal,
        hexNormalInv: decoded.hexNormalInv,
        decNormal: decoded.canNumeric ? decoded.valueNormal.toString() : '',
        decNormalInv: decoded.canNumeric ? decoded.valueNormalInv.toString() : '',
        hexReverse: decoded.hexReverse,
        hexReverseInv: decoded.hexReverseInv,
        decReverse: decoded.canNumeric ? decoded.valueReverse.toString() : '',
        decReverseInv: decoded.canNumeric ? decoded.valueReverseInv.toString() : '',
      };
      for (const key of Object.keys(map) as FieldId[]) {
        if (editingFieldRef.current !== key) {
          next[key] = { value: map[key], error: false, editing: false };
        }
      }
      return next;
    });
  }, [buffer, cursorPosition, selection.start, selection.end, renderKey]);

  // Write hex bytes to buffer at selection start
  const writeToBuffer = (hexStr: string) => {
    if (!buffer || !selRange) return;
    buffer.pasteSequence(hexStr, selRange.start);
    setModified(true);
    // Bump renderKey to repaint hex view
    useHexEditorStore.setState((s) => ({ renderKey: s.renderKey + 1 }));
  };

  // --- Encode functions (one per field, mirroring Angular) ---

  const encodeHexNormal = (text: string) => {
    const clean = text.replace(/[^0-9a-fA-F]/g, '');
    if (!selRange || !validateHexValue(clean, selRange.count)) return false;
    writeToBuffer(alignToLength(clean, selRange.count * 2));
    return true;
  };

  const encodeHexNormalInv = (text: string) => {
    const clean = text.replace(/[^0-9a-fA-F]/g, '');
    if (!selRange || !validateHexValue(clean, selRange.count)) return false;
    const padded = alignToLength(clean, selRange.count * 2);
    writeToBuffer(hexInvert(padded));
    return true;
  };

  const encodeDecNormal = (text: string) => {
    const clean = text.replace(/[^\-0-9]/g, '');
    if (!selRange || !validateDecValue(clean, selRange.count)) return false;
    const val = parseInt(clean, 10);
    writeToBuffer(hexEncode(val, selRange.count));
    return true;
  };

  const encodeDecNormalInv = (text: string) => {
    const clean = text.replace(/[^\-0-9]/g, '');
    if (!selRange || !validateDecValue(clean, selRange.count)) return false;
    const val = parseInt(clean, 10);
    writeToBuffer(hexInvert(hexEncode(val, selRange.count)));
    return true;
  };

  const encodeHexReverse = (text: string) => {
    const clean = text.replace(/[^0-9a-fA-F]/g, '');
    if (!selRange || !validateHexValue(clean, selRange.count)) return false;
    const padded = alignToLength(clean, selRange.count * 2);
    writeToBuffer(reverseByteString(padded));
    return true;
  };

  const encodeHexReverseInv = (text: string) => {
    const clean = text.replace(/[^0-9a-fA-F]/g, '');
    if (!selRange || !validateHexValue(clean, selRange.count)) return false;
    const padded = alignToLength(clean, selRange.count * 2);
    writeToBuffer(hexInvert(reverseByteString(padded)));
    return true;
  };

  const encodeDecReverse = (text: string) => {
    const clean = text.replace(/[^\-0-9]/g, '');
    if (!selRange || !validateDecValue(clean, selRange.count)) return false;
    const val = parseInt(clean, 10);
    writeToBuffer(reverseByteString(hexEncode(val, selRange.count)));
    return true;
  };

  const encodeDecReverseInv = (text: string) => {
    const clean = text.replace(/[^\-0-9]/g, '');
    if (!selRange || !validateDecValue(clean, selRange.count)) return false;
    const val = parseInt(clean, 10);
    writeToBuffer(hexInvert(reverseByteString(hexEncode(val, selRange.count))));
    return true;
  };

  // Map field IDs to their encoder
  const encoders: Record<FieldId, (text: string) => boolean> = {
    hexNormal: encodeHexNormal,
    hexNormalInv: encodeHexNormalInv,
    decNormal: encodeDecNormal,
    decNormalInv: encodeDecNormalInv,
    hexReverse: encodeHexReverse,
    hexReverseInv: encodeHexReverseInv,
    decReverse: encodeDecReverse,
    decReverseInv: encodeDecReverseInv,
  };

  const handleChange = (fieldId: FieldId, text: string) => {
    editingFieldRef.current = fieldId;
    const encoder = encoders[fieldId];
    const ok = encoder(text);
    setFields((prev) => ({
      ...prev,
      [fieldId]: { value: text, error: !ok, editing: true },
    }));
  };

  const handleFocus = (fieldId: FieldId) => {
    editingFieldRef.current = fieldId;
    setFields((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], editing: true },
    }));
  };

  const handleBlur = (_fieldId: FieldId) => {
    editingFieldRef.current = null;
  };

  // Header text
  const headerText = (() => {
    if (!decoded) return 'No selection';
    if (decoded.count === 1) return `Byte at 0x${toHex(decoded.start, 8)}`;
    return `Bytes 0x${toHex(decoded.start, 8)} - 0x${toHex(decoded.end, 8)} (${decoded.count} bytes)`;
  })();

  if (!buffer) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Inspector</Text>
        <Text style={styles.noData}>No file loaded</Text>
      </View>
    );
  }

  const renderField = (label: string, fieldId: FieldId) => {
    const f = fields[fieldId];
    return (
      <View style={styles.row} key={fieldId}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, f.error && styles.inputError]}
          value={f.value}
          onChangeText={(text) => handleChange(fieldId, text)}
          onFocus={() => handleFocus(fieldId)}
          onBlur={() => handleBlur(fieldId)}
          selectTextOnFocus
        />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Inspector</Text>
      <Text style={styles.subHeader}>{headerText}</Text>

      {decoded && (
        <View style={styles.columns}>
          {/* Normal Order Section */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Normal Order (Big-Endian)</Text>
              {renderField('Hex:', 'hexNormal')}
              {renderField('Hex Inv:', 'hexNormalInv')}
              {decoded.canNumeric && renderField('Decimal:', 'decNormal')}
              {decoded.canNumeric && renderField('Dec Inv:', 'decNormalInv')}
            </View>
          </View>

          {/* Reverse Order Section */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reverse Order (Little-Endian)</Text>
              {renderField('Hex:', 'hexReverse')}
              {renderField('Hex Inv:', 'hexReverseInv')}
              {decoded.canNumeric && renderField('Decimal:', 'decReverse')}
              {decoded.canNumeric && renderField('Dec Inv:', 'decReverseInv')}
            </View>
          </View>

          {/* Checksum Section (read-only) */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Checksums</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Sum (8-bit):</Text>
                <TextInput style={styles.input} value={decoded.sum8} editable={false} selectTextOnFocus />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>XOR:</Text>
                <TextInput style={styles.input} value={decoded.xorSum} editable={false} selectTextOnFocus />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Sum (16-bit):</Text>
                <TextInput style={styles.input} value={decoded.sum16} editable={false} selectTextOnFocus />
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    padding: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#cccccc',
  },
  subHeader: {
    fontSize: 12,
    color: '#858585',
    marginBottom: 12,
  },
  noData: {
    fontSize: 14,
    color: '#858585',
    fontStyle: 'italic',
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  column: {
    flex: 1,
    minWidth: 300,
  },
  section: {
    marginBottom: 12,
    backgroundColor: '#252526',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#cccccc',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    width: 80,
    fontSize: 13,
    color: '#999999',
  },
  input: {
    flex: 1,
    height: 30,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: '#2d2d2d',
    color: '#cccccc',
  },
  inputError: {
    borderColor: '#f85149',
    backgroundColor: '#3c1f1f',
  },
});

export default Inspector;
