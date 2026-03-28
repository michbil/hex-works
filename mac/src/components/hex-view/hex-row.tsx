import React from 'react';
import {View, Text, StyleSheet, Pressable} from 'react-native';
import {BinaryBuffer} from '@shared/utils/binbuf';
import {byteToHex, addressToHex, byteToChar} from '@shared/utils/helpers';

// Color map for byte highlighting (same as beta)
const COLOR_MAP: Record<number, string> = {
  0: 'transparent',
  1: '#E57373', // Red
  2: '#80CBC4', // Teal
  3: '#FFEB3B', // Yellow
  4: '#64B5F6', // Blue
  5: '#B39DDB', // Purple
  6: '#A1887F', // Brown
  7: '#9E9E9E', // Grey
};

const SELECTION_COLOR = '#ADD8E6';
const CURSOR_COLOR = 'rgba(68,68,153,0.5)';
const MARKED_TEXT_COLOR = '#F44336';

interface HexRowProps {
  offset: number;
  buffer: BinaryBuffer;
  colorBuffer: BinaryBuffer;
  bytesPerLine: number;
  cursorPosition: number;
  selectionStart: number;
  selectionEnd: number;
  focused: boolean;
  fontSize: number;
  charWidth: number;
  onBytePress: (byteIndex: number, isAscii: boolean) => void;
}

function HexRowInner({
  offset,
  buffer,
  colorBuffer,
  bytesPerLine,
  cursorPosition,
  selectionStart,
  selectionEnd,
  focused,
  fontSize,
  charWidth,
  onBytePress,
}: HexRowProps) {
  const lineHeight = fontSize + 4;
  const count = Math.min(bytesPerLine, buffer.length - offset);

  const hexBytes: React.ReactNode[] = [];
  const asciiChars: React.ReactNode[] = [];

  const selMin = Math.min(selectionStart, selectionEnd);
  const selMax = Math.max(selectionStart, selectionEnd);
  const hasSelection = selMin !== selMax;

  for (let i = 0; i < count; i++) {
    const byteIndex = offset + i;
    const byte = buffer.getByte(byteIndex);
    const color = colorBuffer.getColor(byteIndex);
    const isMarked = buffer.isMarked(byteIndex);
    const isCursor = focused && byteIndex === cursorPosition;
    const isSelected = hasSelection && byteIndex >= selMin && byteIndex < selMax;

    let bgColor = 'transparent';
    if (isCursor) {
      bgColor = CURSOR_COLOR;
    } else if (isSelected) {
      bgColor = SELECTION_COLOR;
    } else if (color > 0 && color < 8) {
      bgColor = COLOR_MAP[color];
    }

    const textColor = isMarked ? MARKED_TEXT_COLOR : '#d4d4d4';

    hexBytes.push(
      <Pressable
        key={`h${i}`}
        onPress={() => onBytePress(byteIndex, false)}>
        <Text
          style={[
            styles.hexByte,
            {
              fontSize,
              lineHeight,
              width: charWidth * 2.5,
              backgroundColor: bgColor,
              color: textColor,
            },
          ]}>
          {byteToHex(byte)}
        </Text>
      </Pressable>,
    );

    asciiChars.push(
      <Pressable
        key={`a${i}`}
        onPress={() => onBytePress(byteIndex, true)}>
        <Text
          style={[
            styles.asciiChar,
            {
              fontSize,
              lineHeight,
              width: charWidth,
              backgroundColor: bgColor,
              color: textColor,
            },
          ]}>
          {byteToChar(byte)}
        </Text>
      </Pressable>,
    );
  }

  return (
    <View style={[styles.row, {height: lineHeight}]}>
      <Text
        style={[
          styles.address,
          {fontSize, lineHeight, width: charWidth * 9},
        ]}>
        {addressToHex(offset)}
      </Text>
      <View style={styles.hexContainer}>{hexBytes}</View>
      <View style={[styles.gap, {width: charWidth * 2}]} />
      <View style={styles.asciiContainer}>{asciiChars}</View>
    </View>
  );
}

export const HexRow = React.memo(HexRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontFamily: 'Menlo',
    color: '#569CD6',
  },
  hexContainer: {
    flexDirection: 'row',
  },
  hexByte: {
    fontFamily: 'Menlo',
    textAlign: 'center',
  },
  asciiChar: {
    fontFamily: 'Menlo',
    textAlign: 'center',
  },
  gap: {},
  asciiContainer: {
    flexDirection: 'row',
  },
});
