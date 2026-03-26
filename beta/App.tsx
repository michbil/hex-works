import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Platform, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { HexView, Inspector, SearchPanel, ColorPicker, ScriptPanel,HeatmapPanel, GraphPanel, Header, StatusBar as AppStatusBar, TabBar } from './src/components';
import { Drawer } from './src/components/layout';
import { FileMenu } from './src/components/layout/header';
import { LocaleProvider } from './src/locales';
import { usePersistence } from './src/hooks/use-persistence';
import { useDropFile } from './src/hooks/use-drop-file';
import { useMobile } from './src/hooks/use-mobile';

type RightPanelTab = 'inspector' | 'search' | 'script' | 'graph' | 'heatmap';

function HexEditorApp() {
  usePersistence();
  useDropFile();
  const { isMobile } = useMobile();

  // Inject mobile-specific CSS to prevent iOS overscroll bounce and pinch zoom
  useEffect(() => {
    if (Platform.OS !== 'web' || !isMobile) return;
    const style = document.createElement('style');
    style.textContent = `
      html, body, #root {
        overflow: hidden;
        position: fixed;
        width: 100%;
        height: 100%;
        touch-action: none;
        overscroll-behavior: none;
      }
    `;
    document.head.appendChild(style);

    // Ensure viewport meta prevents zoom
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    }

    return () => {
      document.head.removeChild(style);
    };
  }, [isMobile]);

  const [showHelp, setShowHelp] = useState(false);
  const [rightTab, setRightTab] = useState<RightPanelTab>('inspector');
  const [refreshKey, setRefreshKey] = useState(0);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

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

  const rightPanelContent = (
    <>
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
        <TouchableOpacity
          style={[styles.panelTab, rightTab === 'graph' && styles.panelTabActive]}
          onPress={() => setRightTab('graph')}
        >
          <Text style={[styles.panelTabText, rightTab === 'graph' && styles.panelTabTextActive]}>
            Graph
             </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.panelTab, rightTab === 'heatmap' && styles.panelTabActive]}
          onPress={() => setRightTab('heatmap')}
        >
          <Text style={[styles.panelTabText, rightTab === 'heatmap' && styles.panelTabTextActive]}>
            Heatmap
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
          <SearchPanel onClose={() => setRightTab('inspector')} />
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
      {rightTab === 'graph' && (
        <View testID="graph-panel" style={{flex: 1}}>
          <GraphPanel onClose={() => setRightTab('inspector')} />
        </View>
      )}
      {rightTab === 'heatmap' && (
        <View testID="heatmap-panel" style={{flex: 1}}>
          <HeatmapPanel />
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        onSearchPress={handleSearchPress}
        onScriptPress={handleScriptPress}
        onHelpPress={handleHelpPress}
        isMobile={isMobile}
        onLeftMenuPress={() => setLeftDrawerOpen(true)}
        onRightMenuPress={() => setRightDrawerOpen(true)}
      />

      {/* Tabs */}
      <TabBar />

      {/* Main Content */}
      <View style={isMobile ? styles.mainContentMobile : styles.mainContent}>
        {/* Hex View */}
        <View style={isMobile ? styles.hexViewContainerMobile : styles.hexViewContainer}>
          <ColorPicker onColorSelect={handleColorSelect} />
          <HexView key={refreshKey} isMobile={isMobile} />
        </View>

        {/* Right Panel — inline on desktop, drawer on mobile */}
        {!isMobile && (
          <View style={styles.rightPanel}>
            {rightPanelContent}
          </View>
        )}
      </View>

      {/* Status Bar */}
      <AppStatusBar />

      {/* Mobile Drawers */}
      {isMobile && (
        <>
          <Drawer visible={leftDrawerOpen} side="left" onClose={() => setLeftDrawerOpen(false)}>
            <FileMenu onClose={() => setLeftDrawerOpen(false)} onHelpPress={handleHelpPress} />
          </Drawer>
          <Drawer visible={rightDrawerOpen} side="right" onClose={() => setRightDrawerOpen(false)}>
            <View style={styles.rightDrawerContent}>
              {rightPanelContent}
            </View>
          </Drawer>
        </>
      )}

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
  mainContentMobile: {
    flex: 1,
    flexDirection: 'column',
  },
  hexViewContainer: {
    width: 700,
    flexShrink: 0,
    padding: 8,
  },
  hexViewContainerMobile: {
    flex: 1,
    padding: 4,
  },
  rightPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#404040',
    backgroundColor: '#1e1e1e',
  },
  rightDrawerContent: {
    flex: 1,
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
