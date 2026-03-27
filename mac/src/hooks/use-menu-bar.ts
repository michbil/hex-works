import {useEffect} from 'react';
import {NativeModules, NativeEventEmitter} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {useFileHandler} from './use-file-handler';
import {stringToByteSeq} from '@shared/utils/helpers';

const {MenuBarModule, FileDialogModule} = NativeModules;

type PanelTab = 'inspector' | 'search';

interface UseMenuBarOptions {
  setRightTab: (tab: PanelTab) => void;
}

export function useMenuBar({setRightTab}: UseMenuBarOptions) {
  const {openFile, saveFile, saveFileAs, createNewFile} = useFileHandler();
  const removeTab = useHexEditorStore(s => s.removeTab);
  const activeTabIndex = useHexEditorStore(s => s.activeTabIndex);
  const buffer = useHexEditorStore(s => s.buffer);
  const setSelection = useHexEditorStore(s => s.setSelection);

  useEffect(() => {
    MenuBarModule.setupMenuBar();

    const emitter = new NativeEventEmitter(MenuBarModule);
    const subscription = emitter.addListener('onMenuAction', (action: string) => {
      const state = useHexEditorStore.getState();
      const buf = state.buffer;

      switch (action) {
        case 'newFile':
          createNewFile(256);
          break;
        case 'openFile':
          openFile();
          break;
        case 'saveFile':
          saveFile();
          break;
        case 'saveFileAs':
          saveFileAs();
          break;
        case 'closeTab':
          if (state.activeTabIndex >= 0) {
            removeTab(state.activeTabIndex);
          }
          break;
        case 'find':
        case 'showSearch':
          setRightTab('search');
          break;
        case 'showInspector':
          setRightTab('inspector');
          break;
        case 'selectAll':
          if (buf) {
            setSelection(0, buf.length - 1);
            useHexEditorStore.setState(s => ({renderKey: s.renderKey + 1}));
          }
          break;
        case 'copy':
          if (buf) {
            const sel = state.selection;
            const start = Math.min(sel.start, sel.end);
            const end = Math.max(sel.start, sel.end);
            const length = start === end ? 1 : end - start + 1;
            const offset = start === end ? state.cursorPosition : start;
            const hex = buf.toHexString(offset, length);
            FileDialogModule.copyToClipboard(hex);
          }
          break;
        case 'paste':
          if (buf) {
            FileDialogModule.pasteFromClipboard().then((text: string) => {
              if (!text) return;
              const s = useHexEditorStore.getState();
              if (!s.buffer) return;
              // Try to parse as hex bytes
              const cleaned = text.replace(/[\s,]/g, '');
              if (/^[0-9a-fA-F]*$/.test(cleaned) && cleaned.length % 2 === 0) {
                const pos = s.cursorPosition;
                s.buffer.pasteSequence(cleaned, pos);
                useHexEditorStore.setState(st => ({
                  isModified: true,
                  renderKey: st.renderKey + 1,
                }));
              }
            });
          }
          break;
        default:
          break;
      }
    });

    return () => subscription.remove();
  }, [openFile, saveFile, saveFileAs, createNewFile, removeTab, setSelection, setRightTab]);
}
