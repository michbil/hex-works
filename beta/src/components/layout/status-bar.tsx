/**
 * StatusBar Component - Bottom status bar
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { useLocale } from '../../locales';

export function StatusBar() {
  const { t } = useLocale();
  const { buffer, cursorPosition, selection, isEditing, bytesPerLine } = useHexEditorStore();

  if (!buffer) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t('ready')}</Text>
      </View>
    );
  }

  const selStart = Math.min(selection.start, selection.end);
  const selEnd = Math.max(selection.start, selection.end);
  const hasSelection = selStart !== selEnd;

  const line = Math.floor(cursorPosition / bytesPerLine) + 1;
  const col = (cursorPosition % bytesPerLine) + 1;

  return (
    <View style={styles.container}>
      {/* Position info */}
      <View style={styles.section}>
        <Text style={styles.label}>Offset:</Text>
        <Text style={styles.value}>
          0x{cursorPosition.toString(16).toUpperCase().padStart(8, '0')}
        </Text>
        <Text style={styles.separator}>|</Text>
        <Text style={styles.label}>Ln:</Text>
        <Text style={styles.value}>{line}</Text>
        <Text style={styles.label}>Col:</Text>
        <Text style={styles.value}>{col}</Text>
      </View>

      {/* Selection info */}
      {hasSelection && (
        <View style={styles.section}>
          <Text style={styles.separator}>|</Text>
          <Text style={styles.label}>Sel:</Text>
          <Text style={styles.value}>
            0x{selStart.toString(16).toUpperCase()} - 0x{selEnd.toString(16).toUpperCase()}
          </Text>
          <Text style={styles.value}>({selEnd - selStart + 1} bytes)</Text>
        </View>
      )}

      {/* Edit mode indicator */}
      <View style={styles.rightSection}>
        <Text style={[styles.indicator, isEditing && styles.indicatorActive]}>
          {isEditing ? 'EDIT' : 'VIEW'}
        </Text>
        <Text style={styles.separator}>|</Text>
        <Text style={styles.text}>
          {t('current')}: {cursorPosition} {t('of')} {buffer.length - 1}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  value: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
  },
  separator: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginHorizontal: 4,
  },
  indicator: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  indicatorActive: {
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});

export default StatusBar;
