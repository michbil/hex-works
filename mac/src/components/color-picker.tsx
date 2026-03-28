import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';

const COLORS = [
  {id: 0, label: 'Clear', color: '#ffffff'},
  {id: 1, label: 'Red', color: '#E57373'},
  {id: 2, label: 'Teal', color: '#80CBC4'},
  {id: 3, label: 'Yellow', color: '#FFEB3B'},
  {id: 4, label: 'Blue', color: '#64B5F6'},
  {id: 5, label: 'Purple', color: '#B39DDB'},
  {id: 6, label: 'Brown', color: '#A1887F'},
  {id: 7, label: 'Grey', color: '#9E9E9E'},
] as const;

interface ColorPickerProps {
  onColorSelect?: () => void;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3c3c3c',
  },
  colorButton: {
    width: 22,
    height: 22,
    borderRadius: 3,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: '#666',
  },
  clearText: {
    fontSize: 12,
    color: '#666',
  },
});

export function ColorPicker({onColorSelect}: ColorPickerProps) {
  const buffer = useHexEditorStore(s => s.buffer);
  const selection = useHexEditorStore(s => s.selection);
  const cursorPosition = useHexEditorStore(s => s.cursorPosition);
  const getColorBuffer = useHexEditorStore(s => s.getColorBuffer);
  const renderKey = useHexEditorStore(s => s.renderKey);

  const handleColorSelect = (colorId: number) => {
    if (!buffer) return;

    const colorBuffer = getColorBuffer() ?? buffer;
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);

    if (start === end) {
      colorBuffer.setColor(cursorPosition, colorId);
    } else {
      for (let i = start; i <= end && i < colorBuffer.length; i++) {
        colorBuffer.setColor(i, colorId);
      }
    }

    // Force re-render of hex view
    useHexEditorStore.setState({renderKey: renderKey + 1});
    onColorSelect?.();
  };

  return (
    <View style={styles.container}>
      {COLORS.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.colorButton,
            {backgroundColor: item.color},
            item.id === 0 && styles.clearButton,
          ]}
          onPress={() => handleColorSelect(item.id)}
          accessibilityLabel={item.label}>
          {item.id === 0 && <Text style={styles.clearText}>{'\u2715'}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}
