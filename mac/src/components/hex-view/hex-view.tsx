import React, {useRef, useCallback, useMemo, useState} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {isHexDigit, keyToHexValue} from '@shared/utils/keys';
import {HexRow} from './hex-row';

const FONT_SIZE = 13;
const CHAR_WIDTH = FONT_SIZE * 0.6;
const LINE_HEIGHT = FONT_SIZE + 4;

/** Calculate optimal bytesPerLine for a given pixel width */
function computeBytesPerLine(width: number): number {
  const available = ((width - 20) / CHAR_WIDTH - 11) / 4;
  const n = Math.floor(available);
  const options = [4, 8, 12, 16, 24, 32];
  for (let i = options.length - 1; i >= 0; i--) {
    if (n >= options[i]) return options[i];
  }
  return 4;
}

export function HexView() {
  const flatListRef = useRef<FlatList>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [focused, setFocused] = useState(true);

  const buffer = useHexEditorStore(s => s.buffer);
  const cursorPosition = useHexEditorStore(s => s.cursorPosition);
  const selection = useHexEditorStore(s => s.selection);
  const scrollOffset = useHexEditorStore(s => s.scrollOffset);
  const bytesPerLine = useHexEditorStore(s => s.bytesPerLine);
  const isEditing = useHexEditorStore(s => s.isEditing);
  const editNibble = useHexEditorStore(s => s.editNibble);
  const renderKey = useHexEditorStore(s => s.renderKey);

  const setCursorPosition = useHexEditorStore(s => s.setCursorPosition);
  const setSelection = useHexEditorStore(s => s.setSelection);
  const setScrollOffset = useHexEditorStore(s => s.setScrollOffset);
  const setBytesPerLine = useHexEditorStore(s => s.setBytesPerLine);
  const setIsEditing = useHexEditorStore(s => s.setIsEditing);
  const setEditNibble = useHexEditorStore(s => s.setEditNibble);
  const setByte = useHexEditorStore(s => s.setByte);
  const getColorBuffer = useHexEditorStore(s => s.getColorBuffer);

  const colorBuffer = getColorBuffer();

  const rowOffsets = useMemo(() => {
    if (!buffer) return [];
    const offsets: number[] = [];
    for (let i = 0; i < buffer.length; i += bytesPerLine) {
      offsets.push(i);
    }
    return offsets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, buffer?.length, bytesPerLine, renderKey]);

  const totalRows = rowOffsets.length;

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setContainerWidth(w);
      const newBpl = computeBytesPerLine(w);
      if (newBpl !== bytesPerLine) {
        setBytesPerLine(newBpl);
      }
    },
    [bytesPerLine, setBytesPerLine],
  );

  const onBytePress = useCallback(
    (byteIndex: number, _isAscii: boolean) => {
      setCursorPosition(byteIndex);
      setSelection(byteIndex, byteIndex);
      setIsEditing(true);
      setEditNibble('high');
    },
    [setCursorPosition, setSelection, setIsEditing, setEditNibble],
  );

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: LINE_HEIGHT,
      offset: LINE_HEIGHT * index,
      index,
    }),
    [],
  );

  // Scroll to cursor when it changes
  React.useEffect(() => {
    if (!buffer || !flatListRef.current) return;
    const cursorRow = Math.floor(cursorPosition / bytesPerLine);
    if (cursorRow >= 0 && cursorRow < totalRows) {
      flatListRef.current.scrollToIndex({
        index: cursorRow,
        viewPosition: 0.5,
        animated: false,
      });
    }
  }, [cursorPosition, bytesPerLine, buffer, totalRows]);

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: any) => {
      if (!buffer) return;
      const key: string = e.nativeEvent?.key ?? e.key ?? '';
      const shift = e.nativeEvent?.shiftKey ?? e.shiftKey ?? false;
      const meta = e.nativeEvent?.metaKey ?? e.metaKey ?? false;

      // Don't handle Cmd+ shortcuts (let menu bar handle them)
      if (meta) return;

      const len = buffer.length;
      let newPos = cursorPosition;

      switch (key) {
        case 'ArrowLeft':
          newPos = Math.max(0, cursorPosition - 1);
          break;
        case 'ArrowRight':
          newPos = Math.min(len - 1, cursorPosition + 1);
          break;
        case 'ArrowUp':
          newPos = Math.max(0, cursorPosition - bytesPerLine);
          break;
        case 'ArrowDown':
          newPos = Math.min(len - 1, cursorPosition + bytesPerLine);
          break;
        case 'PageUp': {
          const visibleRows = Math.floor(containerWidth / LINE_HEIGHT);
          newPos = Math.max(0, cursorPosition - visibleRows * bytesPerLine);
          break;
        }
        case 'PageDown': {
          const visibleRows = Math.floor(containerWidth / LINE_HEIGHT);
          newPos = Math.min(
            len - 1,
            cursorPosition + visibleRows * bytesPerLine,
          );
          break;
        }
        case 'Home':
          newPos = 0;
          break;
        case 'End':
          newPos = len - 1;
          break;
        default:
          // Hex editing
          if (isEditing && isHexDigit(key)) {
            const hexVal = keyToHexValue(key);
            if (hexVal !== null) {
              const currentByte = buffer.getByte(cursorPosition);
              let newByte: number;
              if (editNibble === 'high') {
                newByte = (hexVal << 4) | (currentByte & 0x0f);
                setByte(cursorPosition, newByte);
                setEditNibble('low');
              } else {
                newByte = (currentByte & 0xf0) | hexVal;
                setByte(cursorPosition, newByte);
                setEditNibble('high');
                // Advance cursor
                if (cursorPosition < len - 1) {
                  setCursorPosition(cursorPosition + 1);
                  setSelection(cursorPosition + 1, cursorPosition + 1);
                }
              }
            }
            return;
          }
          return;
      }

      // Navigation occurred
      if (newPos !== cursorPosition) {
        setCursorPosition(newPos);
        if (shift) {
          // Extend selection
          const anchor =
            selection.start === cursorPosition
              ? selection.end
              : selection.start;
          setSelection(
            Math.min(anchor, newPos),
            Math.max(anchor, newPos),
          );
        } else {
          setSelection(newPos, newPos);
        }
        setEditNibble('high');
      }
    },
    [
      buffer,
      cursorPosition,
      bytesPerLine,
      containerWidth,
      isEditing,
      editNibble,
      selection,
      setCursorPosition,
      setSelection,
      setByte,
      setEditNibble,
    ],
  );

  const renderRow = useCallback(
    ({item: offset}: {item: number}) => {
      if (!buffer || !colorBuffer) return null;
      return (
        <HexRow
          offset={offset}
          buffer={buffer}
          colorBuffer={colorBuffer}
          bytesPerLine={bytesPerLine}
          cursorPosition={cursorPosition}
          selectionStart={selection.start}
          selectionEnd={selection.end}
          focused={focused}
          fontSize={FONT_SIZE}
          charWidth={CHAR_WIDTH}
          onBytePress={onBytePress}
        />
      );
    },
    [
      buffer,
      colorBuffer,
      bytesPerLine,
      cursorPosition,
      selection.start,
      selection.end,
      focused,
      onBytePress,
      renderKey,
    ],
  );

  const keyExtractor = useCallback(
    (item: number) => item.toString(),
    [],
  );

  if (!buffer) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          {/* Empty state handled by App.tsx */}
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      // @ts-ignore - react-native-macos keyboard support
      focusable={true}
      onKeyDown={handleKeyDown}
      validKeysDown={[
        {key: 'ArrowUp'},
        {key: 'ArrowDown'},
        {key: 'ArrowLeft'},
        {key: 'ArrowRight'},
        {key: 'PageUp'},
        {key: 'PageDown'},
        {key: 'Home'},
        {key: 'End'},
        {key: 'Tab'},
        ...'0123456789abcdef'
          .split('')
          .map(k => ({key: k})),
        ...'ABCDEF'.split('').map(k => ({key: k})),
      ]}>
      <FlatList
        ref={flatListRef}
        data={rowOffsets}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        style={styles.list}
        initialNumToRender={40}
        maxToRenderPerBatch={20}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  list: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
