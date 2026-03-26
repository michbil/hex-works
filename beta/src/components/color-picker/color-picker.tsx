/**
 * ColorPicker Component - Color marking for bytes
 * Ported from AngularJS hex-works app
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { useTranslation } from '../../locales';
import { useMobile } from '../../hooks/use-mobile';

// Color palette matching the Angular version
const COLORS = [
  { id: 0, name: 'White', color: '#ffffff' },
  { id: 1, name: 'Red', color: '#E57373' },
  { id: 2, name: 'Teal', color: '#80CBC4' },
  { id: 3, name: 'Yellow', color: '#FFEB3B' },
  { id: 4, name: 'Blue', color: '#64B5F6' },
  { id: 5, name: 'Purple', color: '#B39DDB' },
  { id: 6, name: 'Brown', color: '#A1887F' },
  { id: 7, name: 'Grey', color: '#9E9E9E' },
];

interface ColorPickerProps {
  onColorSelect?: (colorId: number) => void;
}

export function ColorPicker({ onColorSelect }: ColorPickerProps) {
  const { buffer, selection, cursorPosition, masterTabId, tabs, activeTabIndex, setMasterTab, getColorBuffer } = useHexEditorStore();
  const { t } = useTranslation();
  const { isMobile } = useMobile();

  const isMaster = masterTabId != null && tabs[activeTabIndex]?.id === masterTabId;

  const handleColorSelect = (colorId: number) => {
    if (!buffer) return;

    const colorBuffer = getColorBuffer() ?? buffer;
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);

    // If no selection, color just the current cursor position
    if (start === end) {
      colorBuffer.setColor(cursorPosition, colorId);
    } else {
      // Color the selected range
      for (let i = start; i <= end && i < colorBuffer.length; i++) {
        colorBuffer.setColor(i, colorId);
      }
    }

    onColorSelect?.(colorId);
  };

  const handleToggleMaster = () => {
    setMasterTab(!isMaster);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.colorGrid}>
          {COLORS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.colorButton,
                isMobile && styles.colorButtonMobile,
                { backgroundColor: item.color },
                item.id === 0 && styles.whiteButton,
              ]}
              onPress={() => handleColorSelect(item.id)}
              accessibilityLabel={item.name}
            >
              {item.id === 0 && <Text style={styles.clearText}>✕</Text>}
            </TouchableOpacity>
          ))}
        </View>
        {tabs.length > 1 && (
          <TouchableOpacity style={styles.applyAll} onPress={handleToggleMaster}>
            {Platform.OS === 'web' ? (
              <input
                type="checkbox"
                checked={isMaster}
                onChange={handleToggleMaster}
                style={{ marginRight: 6 }}
              />
            ) : (
              <View style={[styles.checkbox, isMaster && styles.checkboxChecked]}>
                {isMaster && <Text style={styles.checkmark}>✓</Text>}
              </View>
            )}
            <Text style={styles.applyAllText}>{t('apply')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#f8f9fa',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#495057',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  applyAll: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  applyAllText: {
    fontSize: 12,
    color: '#495057',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#6c757d',
    borderRadius: 2,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  colorButtonMobile: {
    width: 40,
    height: 40,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  whiteButton: {
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  clearText: {
    fontSize: 16,
    color: '#6c757d',
  },
});

export default ColorPicker;
