import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { BinaryBuffer } from '../utils/binbuf';
import { useHexEditorStore } from '../contexts/hex-editor-store';

/**
 * Hook that enables drag-and-drop file loading on web.
 * Attaches dragover/drop listeners to the document so files
 * can be dropped anywhere on the editor.
 */
export function useDropFile() {
  const addTab = useHexEditorStore((s) => s.addTab);
  const attachedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || attachedRef.current) return;
    attachedRef.current = true;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          const buf = new BinaryBuffer(arrayBuffer);
          addTab(buf, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
      attachedRef.current = false;
    };
  }, [addTab]);
}
