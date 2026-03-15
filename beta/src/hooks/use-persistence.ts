import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useHexEditorStore } from '../contexts/hex-editor-store';
import { saveTabs, loadTabs } from '../utils/persistence';

const AUTO_SAVE_INTERVAL = 2000; // 2 seconds, matching Angular version

/**
 * Hook that restores tabs from IndexedDB on mount
 * and auto-saves every 2 seconds (only dirty tabs).
 */
export function usePersistence() {
  const addTab = useHexEditorStore((s) => s.addTab);
  const switchTab = useHexEditorStore((s) => s.switchTab);
  const restoredRef = useRef(false);

  // Restore tabs on mount
  useEffect(() => {
    if (Platform.OS !== 'web' || restoredRef.current) return;
    restoredRef.current = true;

    loadTabs().then((result) => {
      if (!result) return;
      // Guard against duplicate restoration (e.g. HMR remount where
      // the ref resets but the Zustand store still holds the tabs)
      const current = useHexEditorStore.getState();
      if (current.tabs.length > 0) return;
      for (const tab of result.tabs) {
        addTab(tab.buffer, tab.fileName);
      }
      // Switch to the previously active tab
      if (result.activeIndex >= 0) {
        switchTab(result.activeIndex);
      }
    });
  }, [addTab, switchTab]);

  // Track which tab IDs have been saved so we can detect tab list changes
  const savedTabIdsRef = useRef<string[]>([]);

  // Auto-save interval — only serializes tabs whose buffer has changed
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const interval = setInterval(() => {
      const state = useHexEditorStore.getState();
      if (state.tabs.length === 0) return;

      // Collect IDs of tabs whose buffer reports changes
      const dirtyIds = new Set<string>();
      for (const tab of state.tabs) {
        if (tab.buffer.changed) {
          dirtyIds.add(tab.id);
        }
      }

      // Detect if the tab list itself changed (added/removed/reordered)
      const currentIds = state.tabs.map((t) => t.id);
      const tabListChanged =
        currentIds.length !== savedTabIdsRef.current.length ||
        currentIds.some((id, i) => id !== savedTabIdsRef.current[i]);

      // Nothing to save
      if (dirtyIds.size === 0 && !tabListChanged) return;

      savedTabIdsRef.current = currentIds;

      saveTabs(
        state.tabs.map((t) => ({ id: t.id, buffer: t.buffer, fileName: t.fileName })),
        state.activeTabIndex,
        dirtyIds.size > 0 ? dirtyIds : undefined,
      );
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, []);
}
