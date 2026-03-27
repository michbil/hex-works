import {useCallback, useRef} from 'react';
import {NativeModules} from 'react-native';
import {BinaryBuffer} from '@shared/utils/binbuf';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';

const {FileDialogModule} = NativeModules;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useFileHandler() {
  const addTab = useHexEditorStore(s => s.addTab);
  const buffer = useHexEditorStore(s => s.buffer);
  const fileName = useHexEditorStore(s => s.fileName);
  const setModified = useHexEditorStore(s => s.setModified);
  const activeTabIndex = useHexEditorStore(s => s.activeTabIndex);
  const tabs = useHexEditorStore(s => s.tabs);

  // Track file paths for "Save" (not "Save As")
  const filePathsRef = useRef<Map<string, string>>(new Map());

  const openFile = useCallback(async () => {
    try {
      const result = await FileDialogModule.openFile();
      if (!result) return; // User cancelled

      const bytes = base64ToUint8Array(result.data);
      const buf = new BinaryBuffer(bytes);
      buf.name = result.name;
      addTab(buf, result.name);

      // Store the file path for subsequent saves
      filePathsRef.current.set(buf.uuid, result.path);

      // Update window title
      FileDialogModule.setWindowTitle(`${result.name} - Hex Works`);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [addTab]);

  const saveFile = useCallback(async () => {
    if (!buffer) return;
    try {
      const base64Data = uint8ArrayToBase64(buffer.buffer);
      const tabId = tabs[activeTabIndex]?.id;
      const existingPath = tabId ? filePathsRef.current.get(tabId) : undefined;

      if (existingPath) {
        // Save to existing path
        await FileDialogModule.saveFileToPath(existingPath, base64Data);
      } else {
        // Show Save As dialog
        const result = await FileDialogModule.saveFile(
          fileName || 'untitled.bin',
          base64Data,
        );
        if (!result) return; // User cancelled
        if (tabId) {
          filePathsRef.current.set(tabId, result.path);
        }
      }
      setModified(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [buffer, fileName, tabs, activeTabIndex, setModified]);

  const saveFileAs = useCallback(async () => {
    if (!buffer) return;
    try {
      const base64Data = uint8ArrayToBase64(buffer.buffer);
      const result = await FileDialogModule.saveFile(
        fileName || 'untitled.bin',
        base64Data,
      );
      if (!result) return;
      const tabId = tabs[activeTabIndex]?.id;
      if (tabId) {
        filePathsRef.current.set(tabId, result.path);
      }
      setModified(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [buffer, fileName, tabs, activeTabIndex, setModified]);

  const createNewFile = useCallback(
    (size: number = 256) => {
      const buf = new BinaryBuffer(size);
      addTab(buf, 'untitled.bin');
      FileDialogModule.setWindowTitle('untitled.bin - Hex Works');
    },
    [addTab],
  );

  return {openFile, saveFile, saveFileAs, createNewFile};
}
