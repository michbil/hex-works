import { useEffect, useEffectEvent } from 'react';
import { useHexEditorStore } from '../contexts/hex-editor-store';
import { isHexDigit, keyToHexValue, isNavigationKey, Keys } from '../utils/keys';

export function useHexNavigation() {
  const {
    buffer,
    cursorPosition,
    bytesPerLine,
    setCursorPosition,
    setSelection,
  } = useHexEditorStore();

  const bufferLength = buffer?.length ?? 0;

  const moveCursor = (direction: 'left' | 'right' | 'up' | 'down', extend: boolean = false) => {
    if (!buffer) return;

    let newPosition = cursorPosition;

    switch (direction) {
      case 'left':
        newPosition = Math.max(0, cursorPosition - 1);
        break;
      case 'right':
        newPosition = Math.min(bufferLength - 1, cursorPosition + 1);
        break;
      case 'up':
        newPosition = Math.max(0, cursorPosition - bytesPerLine);
        break;
      case 'down':
        newPosition = Math.min(bufferLength - 1, cursorPosition + bytesPerLine);
        break;
    }

    setCursorPosition(newPosition);

    if (!extend) {
      setSelection(newPosition, newPosition);
    }
  };

  const goToStart = (extend: boolean = false) => {
    setCursorPosition(0);
    if (!extend) setSelection(0, 0);
  };

  const goToEnd = (extend: boolean = false) => {
    const end = bufferLength - 1;
    setCursorPosition(end);
    if (!extend) setSelection(end, end);
  };

  const goToOffset = (offset: number) => {
    const clampedOffset = Math.max(0, Math.min(offset, bufferLength - 1));
    setCursorPosition(clampedOffset);
    setSelection(clampedOffset, clampedOffset);
  };

  const pageUp = () => {
    const linesPerPage = 20; // TODO: Calculate from viewport
    const newPosition = Math.max(0, cursorPosition - bytesPerLine * linesPerPage);
    setCursorPosition(newPosition);
    setSelection(newPosition, newPosition);
  };

  const pageDown = () => {
    const linesPerPage = 20;
    const newPosition = Math.min(
      bufferLength - 1,
      cursorPosition + bytesPerLine * linesPerPage
    );
    setCursorPosition(newPosition);
    setSelection(newPosition, newPosition);
  };

  return {
    moveCursor,
    goToStart,
    goToEnd,
    goToOffset,
    pageUp,
    pageDown,
  };
}

export function useHexKeyboard() {
  const { buffer, isEditing, cursorPosition, editNibble, setByte, setEditNibble } =
    useHexEditorStore();
  const { moveCursor, goToStart, goToEnd, pageUp, pageDown } = useHexNavigation();

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const { key, shiftKey } = event;

    // Handle navigation
    if (isNavigationKey(key)) {
      event.preventDefault();

      switch (key) {
        case Keys.LEFT:
          moveCursor('left', shiftKey);
          break;
        case Keys.RIGHT:
          moveCursor('right', shiftKey);
          break;
        case Keys.UP:
          moveCursor('up', shiftKey);
          break;
        case Keys.DOWN:
          moveCursor('down', shiftKey);
          break;
        case Keys.HOME:
          goToStart(shiftKey);
          break;
        case Keys.END:
          goToEnd(shiftKey);
          break;
        case Keys.PAGE_UP:
          pageUp();
          break;
        case Keys.PAGE_DOWN:
          pageDown();
          break;
      }
      return;
    }

    // Handle hex input when editing
    if (isEditing && isHexDigit(key) && buffer) {
      event.preventDefault();
      const hexValue = keyToHexValue(key);
      if (hexValue === null) return;

      const currentByte = buffer.getByte(cursorPosition);

      let newByte: number;
      if (editNibble === 'high') {
        newByte = (hexValue << 4) | (currentByte & 0x0f);
        setByte(cursorPosition, newByte);
        setEditNibble('low');
      } else {
        newByte = (currentByte & 0xf0) | hexValue;
        setByte(cursorPosition, newByte);
        setEditNibble('high');
        moveCursor('right');
      }
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { handleKeyDown };
}

export default useHexNavigation;
