import React from 'react';
import {View, Text, ScrollView, Pressable, StyleSheet} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';

export function TabBar() {
  const tabs = useHexEditorStore(s => s.tabs);
  const activeTabIndex = useHexEditorStore(s => s.activeTabIndex);
  const switchTab = useHexEditorStore(s => s.switchTab);
  const removeTab = useHexEditorStore(s => s.removeTab);

  if (tabs.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}>
        {tabs.map((tab, index) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              index === activeTabIndex && styles.activeTab,
            ]}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#3c3c3c',
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
