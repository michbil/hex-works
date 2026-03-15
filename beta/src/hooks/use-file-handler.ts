import { useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { BinaryBuffer } from '../utils/binbuf';
import { useHexEditorStore } from '../contexts/hex-editor-store';

export function useFileHandler() {
  const { setBuffer, clearBuffer, buffer, fileName, isModified } = useHexEditorStore();

  const openFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      const file = result.assets[0];
      
      // Use fetch API which works on both web and native
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const binaryBuffer = new BinaryBuffer(arrayBuffer);
      setBuffer(binaryBuffer, file.name);
      return { name: file.name, size: binaryBuffer.length };
    } catch (error) {
      console.error('Error opening file:', error);
      throw error;
    }
  }, [setBuffer]);

  const saveFile = useCallback(async (customFileName?: string) => {
    if (!buffer) {
      throw new Error('No buffer to save');
    }

    const name = customFileName ?? fileName ?? 'untitled.bin';

    if (Platform.OS === 'web') {
      // Web: trigger download
      const arrayBuffer = buffer.buffer.buffer.slice(
        buffer.buffer.byteOffset,
        buffer.buffer.byteOffset + buffer.buffer.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Native: For now, just log - full native implementation would need expo-sharing
      console.log('Native save not fully implemented yet');
    }

    return { name, size: buffer.length };
  }, [buffer, fileName]);

  const createNewFile = useCallback((size: number = 256) => {
    const newBuffer = new BinaryBuffer(new Uint8Array(size));
    setBuffer(newBuffer, 'untitled.bin');
    return { name: 'untitled.bin', size };
  }, [setBuffer]);

  const closeFile = useCallback(() => {
    clearBuffer();
  }, [clearBuffer]);

  return {
    openFile,
    saveFile,
    createNewFile,
    closeFile,
    hasFile: buffer !== null,
    fileName,
    isModified,
    fileSize: buffer?.length ?? 0,
  };
}

export default useFileHandler;
