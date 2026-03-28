import React, {useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  NativeModules,
  requireNativeComponent,
} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';

const {FileDialogModule} = NativeModules;
const RightClickView = requireNativeComponent('RightClickView');

export function TabBar() {
  const tabs = useHexEditorStore(s => s.tabs);
  const activeTabIndex = useHexEditorStore(s => s.activeTabIndex);
  const switchTab = useHexEditorStore(s => s.switchTab);
  const removeTab = useHexEditorStore(s => s.removeTab);
  const compareToTab = useHexEditorStore(s => s.compareToTab);
  const resizeBuffer = useHexEditorStore(s => s.resizeBuffer);

  const showContextMenu = useCallback(
    async (tabIndex: number) => {
      switchTab(tabIndex);

      const state = useHexEditorStore.getState();
      const buf = state.buffer;

      const items: Array<{label: string; action: string}> = [
        {label: 'Change Buffer Size...', action: 'resize'},
        {label: 'Close Tab', action: 'close'},
      ];

      // Add compare options if multiple tabs
      if (tabs.length > 1) {
        items.push({label: '---', action: ''});
        tabs.forEach((tab, i) => {
          if (i !== tabIndex) {
            items.push({
              label: `Compare to: ${tab.fileName}`,
              action: `compare:${i}`,
            });
          }
        });
      }

      const action = await FileDialogModule.showContextMenu(items);
      if (!action) return;

      if (action === 'resize') {
        const currentSize = buf ? String(buf.length) : '256';
        const result = await FileDialogModule.showInputAlert(
          'Change Buffer Size',
          'Enter new size in bytes:',
          currentSize,
        );
        if (result != null) {
          const size = parseInt(result, 10);
          if (!isNaN(size) && size > 0) {
            resizeBuffer(size);
          }
        }
      } else if (action === 'close') {
        removeTab(tabIndex);
      } else if (action.startsWith('compare:')) {
        const targetIndex = parseInt(action.split(':')[1], 10);
        compareToTab(targetIndex);
      }
    },
    [tabs, switchTab, removeTab, compareToTab, resizeBuffer],
  );

  if (tabs.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}>
        {tabs.map((tab, index) => (
          <RightClickView
            key={tab.id}
            style={[
              styles.tab,
              index === activeTabIndex && styles.activeTab,
            ]}
            onRightClick={() => showContextMenu(index)}>
            <Pressable
              style={styles.tabInner}
              onPress={() => switchTab(index)}>
              <Text
                style={[
                  styles.tabText,
                  index === activeTabIndex && styles.activeTabText,
                ]}
                numberOfLines={1}>
                {tab.isModified ? '\u2022 ' : ''}
                {tab.fileName}
              </Text>
              <Pressable
                style={styles.closeButton}
                onPress={e => {
                  e.stopPropagation?.();
                  removeTab(index);
                }}>
                <Text style={styles.closeText}>{'\u00D7'}</Text>
              </Pressable>
            </Pressable>
          </RightClickView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#252526',
    borderBottomWidth: 1,
    borderBottomColor: '#3c3c3c',
    height: 35,
  },
  scrollView: {
    flexDirection: 'row',
  },
  tab: {
    borderRightWidth: 1,
    borderRightColor: '#3c3c3c',
    height: 35,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 35,
  },
  activeTab: {
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 2,
    borderBottomColor: '#569CD6',
  },
  tabText: {
    color: '#888888',
    fontSize: 12,
    fontFamily: 'Menlo',
    maxWidth: 150,
  },
  activeTabText: {
    color: '#cccccc',
  },
  closeButton: {
    marginLeft: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 3,
  },
  closeText: {
    color: '#888888',
    fontSize: 14,
    lineHeight: 16,
  },
});
