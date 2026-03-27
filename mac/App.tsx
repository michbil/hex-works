import React, {useState, useCallback} from 'react';
import {View, Text, Pressable, StyleSheet, NativeModules} from 'react-native';
import {I18nextProvider, useTranslation} from '@shared/locales';
import i18n from '@shared/locales';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {Inspector} from '@shared/components/inspector/inspector';
import {HexView} from './src/components/hex-view';
import {TabBar} from './src/components/layout/tab-bar';
import {ColorPicker} from './src/components/color-picker';
import {useMenuBar} from './src/hooks/use-menu-bar';
import {useFileHandler} from './src/hooks/use-file-handler';

const {FileDialogModule} = NativeModules;

type PanelTab = 'inspector' | 'search';

function StatusBar() {
  const {t} = useTranslation();
  const buffer = useHexEditorStore(s => s.buffer);
  const cursorPosition = useHexEditorStore(s => s.cursorPosition);
  const bytesPerLine = useHexEditorStore(s => s.bytesPerLine);
  const selection = useHexEditorStore(s => s.selection);
  const isEditing = useHexEditorStore(s => s.isEditing);

  if (!buffer) return null;

  const line = Math.floor(cursorPosition / bytesPerLine);
  const col = cursorPosition % bytesPerLine;
  const selMin = Math.min(selection.start, selection.end);
  const selMax = Math.max(selection.start, selection.end);
  const hasSelection = selMin !== selMax;

  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusText}>
        {t('offset')}: 0x{cursorPosition.toString(16).toUpperCase().padStart(8, '0')}
      </Text>
      <Text style={styles.statusText}>
        {t('line')}: {line} {t('col')}: {col}
      </Text>
      {hasSelection && (
        <Text style={styles.statusText}>
          {t('selectionLabel')}: {selMax - selMin} {t('bytes')}
        </Text>
      )}
      <Text style={styles.statusText}>
        {isEditing ? t('editMode') : t('viewMode')}
      </Text>
      <View style={styles.statusSpacer} />
      <Text style={styles.statusText}>
        {buffer.length} {t('bytes')}
      </Text>
    </View>
  );
}

function EmptyState() {
  const {t} = useTranslation();
  const {openFile, createNewFile} = useFileHandler();

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Hex Works</Text>
      <Text style={styles.emptySubtitle}>macOS Edition</Text>
      <View style={styles.emptyActions}>
        <Pressable style={styles.emptyButton} onPress={() => createNewFile(256)}>
          <Text style={styles.emptyButtonText}>{t('new')} (Cmd+N)</Text>
        </Pressable>
        <Pressable style={styles.emptyButton} onPress={openFile}>
          <Text style={styles.emptyButtonText}>{t('open')} (Cmd+O)</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HexEditorApp() {
  const [rightTab, setRightTab] = useState<PanelTab>('inspector');

  const buffer = useHexEditorStore(s => s.buffer);
  const fileName = useHexEditorStore(s => s.fileName);

  // Set up native menu bar
  useMenuBar({setRightTab});

  // Update window title when tab changes
  React.useEffect(() => {
    if (fileName) {
      FileDialogModule.setWindowTitle(`${fileName} - Hex Works`);
    } else {
      FileDialogModule.setWindowTitle('Hex Works');
    }
  }, [fileName]);

  if (!buffer) {
    return <EmptyState />;
  }

  return (
    <View style={styles.mainContainer}>
      <TabBar />
      <View style={styles.contentRow}>
        <View style={styles.hexViewContainer}>
          <ColorPicker />
          <HexView />
        </View>
        <View style={styles.rightPanel}>
          <View style={styles.panelTabBar}>
            {(['inspector', 'search'] as PanelTab[]).map(tab => (
              <Pressable
                key={tab}
                style={[
                  styles.panelTab,
                  rightTab === tab && styles.panelTabActive,
                ]}
                onPress={() => setRightTab(tab)}>
                <Text
                  style={[
                    styles.panelTabText,
                    rightTab === tab && styles.panelTabTextActive,
                  ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.panelContent}>
            {rightTab === 'inspector' && <Inspector />}
            {rightTab === 'search' && (
              <Text style={styles.panelPlaceholder}>Search panel (coming soon)</Text>
            )}
          </View>
        </View>
      </View>
      <StatusBar />
    </View>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <HexEditorApp />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  hexViewContainer: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: '#3c3c3c',
  },
  rightPanel: {
    flex: 1,
    minWidth: 280,
    maxWidth: 400,
    backgroundColor: '#252526',
  },
  panelTabBar: {
    flexDirection: 'row',
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3c3c3c',
  },
  panelTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  panelTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#569CD6',
  },
  panelTabText: {
    color: '#888888',
    fontSize: 12,
  },
  panelTabTextActive: {
    color: '#cccccc',
  },
  panelContent: {
    flex: 1,
    padding: 12,
  },
  panelPlaceholder: {
    color: '#888888',
    fontSize: 13,
  },
  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007ACC',
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 24,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Menlo',
    marginRight: 16,
  },
  statusSpacer: {
    flex: 1,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  emptyTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#cccccc',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 32,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 16,
  },
  emptyButton: {
    backgroundColor: '#0e639c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
});
