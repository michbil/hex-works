import {useEffect} from 'react';
import {NativeModules, NativeEventEmitter} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {useFileHandler} from './use-file-handler';

const {MenuBarModule} = NativeModules;

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
    // Set up native menu bar
    MenuBarModule.setupMenuBar();

    const emitter = new NativeEventEmitter(MenuBarModule);
    const subscription = emitter.addListener('onMenuAction', (action: string) => {
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
          if (activeTabIndex >= 0) {
            removeTab(activeTabIndex);
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
          if (buffer) {
            setSelection(0, buffer.length);
          }
          break;
        case 'copy':
          // Copy selection as hex string
          if (buffer) {
            const sel = useHexEditorStore.getState().selection;
            if (sel.start !== sel.end) {
              const start = Math.min(sel.start, sel.end);
              const end = Math.max(sel.start, sel.end);
              const hex = buffer.toHexString(start, end - start);
              // TODO: clipboard integration
              console.log('Copy:', hex);
            }
          }
          break;
        default:
          console.log('Unhandled menu action:', action);
      }
    });

    return () => subscription.remove();
  }, [
    openFile,
    saveFile,
    saveFileAs,
    createNewFile,
    removeTab,
    activeTabIndex,
    buffer,
    setSelection,
    setRightTab,
  ]);
}
