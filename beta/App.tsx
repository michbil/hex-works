import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Platform, Modal, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { HexView, Inspector, SearchPanel, ColorPicker, ScriptPanel, Header, StatusBar as AppStatusBar, TabBar } from './src/components';
import { LocaleProvider } from './src/locales';
import { usePersistence } from './src/hooks/use-persistence';
import { useDropFile } from './src/hooks/use-drop-file';

type RightPanelTab = 'inspector' | 'search' | 'script';

function HexEditorApp() {
  usePersistence();
  useDropFile();

  const [showHelp, setShowHelp] = useState(false);
  const [rightTab, setRightTab] = useState<RightPanelTab>('inspector');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSearchPress = useCallback(() => {
    setRightTab(prev => prev === 'search' ? 'inspector' : 'search');
  }, []);

  const handleScriptPress = useCallback(() => {
    setRightTab(prev => prev === 'script' ? 'inspector' : 'script');
  }, []);

  const handleHelpPress = useCallback(() => {
    setShowHelp(true);
  }, []);

  const handleColorSelect = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleBufferModified = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const dimensions = useWindowDimensions()
  const bytesPerLine = dimensions.width < 700 ? 8 : 16;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header onSearchPress={handleSearchPress} onScriptPress={handleScriptPress} onHelpPress={handleHelpPress} />

      {/* Tabs */}
      <TabBar />

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Hex View - fixed width */}
        <View style={styles.hexViewContainer}>
          <ColorPicker onColorSelect={handleColorSelect} />
          <HexView key={refreshKey} bytesPerLine={bytesPerLine} />
        </View>

        {/* Right Panel with tabs */}
        <View style={styles.rightPanel}>
          {/* Tab bar */}
          <View style={styles.panelTabBar} testID="panel-tab-bar">
            <TouchableOpacity
              style={[styles.panelTab, rightTab === 'inspector' && styles.panelTabActive]}
              onPress={() => setRightTab('inspector')}
            >
              <Text style={[styles.panelTabText, rightTab === 'inspector' && styles.panelTabTextActive]}>
                Inspector
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.panelTab, rightTab === 'search' && styles.panelTabActive]}
              onPress={() => setRightTab('search')}
            >
              <Text style={[styles.panelTabText, rightTab === 'search' && styles.panelTabTextActive]}>
                Search
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.panelTab, rightTab === 'script' && styles.panelTabActive]}
              onPress={() => setRightTab('script')}
            >
              <Text style={[styles.panelTabText, rightTab === 'script' && styles.panelTabTextActive]}>
                Script
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab content */}
          {rightTab === 'inspector' && (
            <ScrollView style={styles.inspectorContent} testID="inspector-panel">
              <Inspector />
            </ScrollView>
          )}
          {rightTab === 'search' && (
            <View testID="search-panel" style={{flex: 1}}>
              <SearchPanel onClose={() => setRightTab('inspector')} bytesPerLine={bytesPerLine}/>
            </View>
          )}
          {rightTab === 'script' && (
            <View testID="script-panel" style={{flex: 1}}>
              <ScriptPanel
                onClose={() => setRightTab('inspector')}
                onBufferModified={handleBufferModified}
              />
            </View>
          )}
        </View>
      </View>

      {/* Status Bar */}
      <AppStatusBar bytesPerLine={bytesPerLine}/>

      {/* Help Modal */}
      <Modal
        visible={showHelp}
        animationType="fade"
        transparent
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hex Works Help</Text>
            <ScrollView style={styles.helpContent}>
              <Text style={styles.helpSection}>Keyboard Shortcuts:</Text>
              <Text style={styles.helpText}>• Arrow keys: Navigate bytes</Text>
              <Text style={styles.helpText}>• Page Up/Down: Scroll pages</Text>
              <Text style={styles.helpText}>• Home/End: Go to start/end of line</Text>
              <Text style={styles.helpText}>• Ctrl+Home/End: Go to start/end of file</Text>
              <Text style={styles.helpText}>• 0-9, A-F: Enter hex values (in edit mode)</Text>
              <Text style={styles.helpText}>• Click in ASCII area: Enter text mode</Text>

              <Text style={styles.helpSection}>Mouse Actions:</Text>
              <Text style={styles.helpText}>• Click: Position cursor</Text>
              <Text style={styles.helpText}>• Drag: Select range</Text>
              <Text style={styles.helpText}>• Scroll wheel: Scroll view</Text>

              <Text style={styles.helpSection}>Features:</Text>
              <Text style={styles.helpText}>• Color marking for byte ranges</Text>
              <Text style={styles.helpText}>• Hex and text search</Text>
              <Text style={styles.helpText}>• Inspector panel with multiple interpretations</Text>
              <Text style={styles.helpText}>• Big-endian and little-endian views</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <HexEditorApp />
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  hexViewContainer: {
    width: 700,
    flexShrink: 0,
    padding: 8,
  },
  rightPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#404040',
    backgroundColor: '#1e1e1e',
  },
  panelTabBar: {
    flexDirection: 'row',
    backgroundColor: '#343a40',
  },
  panelTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  panelTabActive: {
    borderBottomColor: '#007bff',
    backgroundColor: '#495057',
  },
  panelTabText: {
    color: '#adb5bd',
    fontSize: 13,
    fontWeight: '500',
  },
  panelTabTextActive: {
    color: '#ffffff',
  },
  inspectorContent: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#212529',
  },
  helpContent: {
    marginBottom: 16,
  },
  helpSection: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: '#495057',
  },
  helpText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
    paddingLeft: 8,
  },
  closeButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
