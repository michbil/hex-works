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

// Module-level singletons — shared across all useFileHandler() calls
export const filePaths = new Map<string, string>();
export const bookmarks = new Map<string, string>();

export function useFileHandler() {
  const addTab = useHexEditorStore(s => s.addTab);
  const buffer = useHexEditorStore(s => s.buffer);
  const fileName = useHexEditorStore(s => s.fileName);
  const setModified = useHexEditorStore(s => s.setModified);
  const activeTabIndex = useHexEditorStore(s => s.activeTabIndex);
  const tabs = useHexEditorStore(s => s.tabs);


  const openFile = useCallback(async () => {
    try {
      const result = await FileDialogModule.openFile();
      if (!result) return; // User cancelled

      // Result is now an array of files
      const files = Array.isArray(result) ? result : [result];

      for (const file of files) {
        const bytes = base64ToUint8Array(file.data);
        const buf = new BinaryBuffer(bytes);
        buf.name = file.name;
        // Set singletons BEFORE addTab (addTab triggers save via subscriber)
        filePaths.set(buf.uuid, file.path);
        if (file.bookmark) {
          bookmarks.set(buf.uuid, file.bookmark);
        }
        addTab(buf, file.name);
      }

      const lastName = files[files.length - 1]?.name;
      if (lastName) {
        FileDialogModule.setWindowTitle(`${lastName} - Hex Works`);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [addTab]);

  const saveFile = useCallback(async () => {
    if (!buffer) return;
    try {
      const base64Data = uint8ArrayToBase64(buffer.buffer);
      const tabId = tabs[activeTabIndex]?.id;
      const existingPath = tabId ? filePaths.get(tabId) : undefined;

      if (existingPath) {
        await FileDialogModule.saveFileToPath(existingPath, base64Data);
      } else {
        const result = await FileDialogModule.saveFile(
          fileName || 'untitled.bin',
          base64Data,
        );
        if (!result) return;
        if (tabId) {
          filePaths.set(tabId, result.path);
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
        filePaths.set(tabId, result.path);
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
