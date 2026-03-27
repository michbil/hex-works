import React, {useCallback, useMemo} from 'react';
import {requireNativeComponent, StyleSheet} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {isHexDigit, keyToHexValue} from '@shared/utils/keys';

const NativeHexView = requireNativeComponent('HexView');

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function HexView() {
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
  const setIsEditing = useHexEditorStore(s => s.setIsEditing);
  const setEditNibble = useHexEditorStore(s => s.setEditNibble);
  const setByte = useHexEditorStore(s => s.setByte);
  const getColorBuffer = useHexEditorStore(s => s.getColorBuffer);

  // Encode buffer data as base64 for native view
  const bufferBase64 = useMemo(() => {
    if (!buffer) return '';
    return uint8ArrayToBase64(buffer.buffer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, renderKey]);

  const colorBase64 = useMemo(() => {
    const colorBuf = getColorBuffer();
    if (!colorBuf) return '';
    // Access the color array - it's a parallel Uint8Array
    const colors = new Uint8Array(colorBuf.length);
    for (let i = 0; i < colorBuf.length; i++) {
      colors[i] = colorBuf.getColor(i);
    }
    return uint8ArrayToBase64(colors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, renderKey, getColorBuffer]);

  const markedBase64 = useMemo(() => {
    if (!buffer) return '';
    const marked = new Uint8Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      marked[i] = buffer.isMarked(i) ? 1 : 0;
    }
    return uint8ArrayToBase64(marked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, renderKey]);

  const onBytePress = useCallback(
    (e: any) => {
      const {index, isAscii} = e.nativeEvent;
      setCursorPosition(index);
      setSelection(index, index);
      setIsEditing(true);
      setEditNibble('high');
    },
    [setCursorPosition, setSelection, setIsEditing, setEditNibble],
  );

  const onSelectionChange = useCallback(
    (e: any) => {
      const {start, end, cursor} = e.nativeEvent;
      setCursorPosition(cursor);
      setSelection(start, end);
    },
    [setCursorPosition, setSelection],
  );

  const onScroll = useCallback(
    (e: any) => {
      const {offset} = e.nativeEvent;
      setScrollOffset(offset);
    },
    [setScrollOffset],
  );

  const onHexKeyDown = useCallback(
    (e: any) => {
      if (!buffer) return;
      const {key, shift, meta} = e.nativeEvent;
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
        case 'Home':
          newPos = 0;
          break;
        case 'End':
          newPos = len - 1;
          break;
        case 'PageUp':
          newPos = Math.max(0, cursorPosition - 20 * bytesPerLine);
          break;
        case 'PageDown':
          newPos = Math.min(len - 1, cursorPosition + 20 * bytesPerLine);
          break;
        default:
          if (isEditing && isHexDigit(key)) {
            const hexVal = keyToHexValue(key);
            if (hexVal !== null) {
              const currentByte = buffer.getByte(cursorPosition);
              if (editNibble === 'high') {
                setByte(cursorPosition, (hexVal << 4) | (currentByte & 0x0f));
                setEditNibble('low');
              } else {
                setByte(cursorPosition, (currentByte & 0xf0) | hexVal);
                setEditNibble('high');
                if (cursorPosition < len - 1) {
                  setCursorPosition(cursorPosition + 1);
                  setSelection(cursorPosition + 1, cursorPosition + 1);
                }
              }
              // Force buffer re-encode for native view
              useHexEditorStore.setState(s => ({renderKey: s.renderKey + 1}));
            }
            return;
          }
          return;
      }

      if (newPos !== cursorPosition) {
        setCursorPosition(newPos);
        if (shift) {
          const anchor =
            selection.start === cursorPosition
              ? selection.end
              : selection.start;
          setSelection(Math.min(anchor, newPos), Math.max(anchor, newPos));
        } else {
          setSelection(newPos, newPos);
        }
        setEditNibble('high');

        // Auto-scroll
        const cursorLine = Math.floor(newPos / bytesPerLine);
        const startLine = Math.floor(scrollOffset / bytesPerLine);
        const visibleRows = 30; // approximate
        if (cursorLine < startLine) {
          setScrollOffset(cursorLine * bytesPerLine);
        } else if (cursorLine >= startLine + visibleRows) {
          setScrollOffset((cursorLine - visibleRows + 1) * bytesPerLine);
        }
      }
    },
    [
      buffer, cursorPosition, bytesPerLine, isEditing, editNibble,
      selection, scrollOffset,
      setCursorPosition, setSelection, setByte, setEditNibble,
      setScrollOffset,
    ],
  );

  if (!buffer) return null;

  return (
    <NativeHexView
      style={styles.hexView}
      bufferBase64={bufferBase64}
      colorBase64={colorBase64}
      markedBase64={markedBase64}
      bufferLength={buffer.length}
      cursorPosition={cursorPosition}
      selectionStart={selection.start}
      selectionEnd={selection.end}
      bytesPerLine={bytesPerLine}
      scrollOffset={scrollOffset}
      fontSize={13}
      isEditing={isEditing}
      editNibble={editNibble}
      focused={true}
      onBytePress={onBytePress}
      onSelectionChange={onSelectionChange}
      onScroll={onScroll}
      onHexKeyDown={onHexKeyDown}
    />
  );
}

const styles = StyleSheet.create({
  hexView: {
    flex: 1,
  },
});
