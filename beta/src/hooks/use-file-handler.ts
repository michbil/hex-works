import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { BinaryBuffer } from '../utils/binbuf';
import { useHexEditorStore } from '../contexts/hex-editor-store';

export function useFileHandler() {
  const { setBuffer, clearBuffer, buffer, fileName, isModified } = useHexEditorStore();

  const openFile = async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
    } catch (error) {
      console.error('Error opening file:', error);
      throw error;
    }

    if (result.canceled) {
      return null;
    }

    const opened: { name: string; size: number }[] = [];
    for (const file of result.assets) {
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const binaryBuffer = new BinaryBuffer(arrayBuffer);
      setBuffer(binaryBuffer, file.name);
      opened.push({ name: file.name, size: binaryBuffer.length });
    }
    return opened;
  };

  const saveFile = async (customFileName?: string) => {
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
  };

  const createNewFile = (size: number = 256) => {
    const newBuffer = new BinaryBuffer(new Uint8Array(size));
    setBuffer(newBuffer, 'untitled.bin');
    return { name: 'untitled.bin', size };
  };

  const closeFile = () => {
    clearBuffer();
  };

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
