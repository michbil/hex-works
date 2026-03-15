'use no memo'
import { create } from 'zustand';
import { BinaryBuffer } from '../utils/binbuf';

export interface Selection {
  start: number;
  end: number;
}

export interface Tab {
  id: string;
  buffer: BinaryBuffer;
  fileName: string;
  isModified: boolean;
  cursorPosition: number;
  scrollOffset: number;
  selection: Selection;
  isEditing: boolean;
  editNibble: 'high' | 'low';
}

function createTab(buffer: BinaryBuffer, fileName: string): Tab {
  return {
    id: buffer.uuid,
    buffer,
    fileName,
    isModified: false,
    cursorPosition: 0,
    scrollOffset: 0,
    selection: { start: 0, end: 0 },
    isEditing: false,
    editNibble: 'high',
  };
}

export interface HexEditorState {
  // Tab state
  tabs: Tab[];
  activeTabIndex: number;

  // Master tab: when set, color operations use the master tab's buffer
  masterTabId: string | null;

  // Derived from active tab (for backward compatibility)
  buffer: BinaryBuffer | null;
  fileName: string | null;
  isModified: boolean;
  bytesPerLine: number;
  scrollOffset: number;
  cursorPosition: number;
  selection: Selection;
  isEditing: boolean;
  editNibble: 'high' | 'low';

  // Render trigger (bumped when buffer internals change without reference change)
  renderKey: number;

  // Tab actions
  addTab: (buffer: BinaryBuffer, fileName?: string) => void;
  removeTab: (index: number) => void;
  switchTab: (index: number) => void;

  // Compare
  compareToTab: (targetIndex: number) => void;

  // Actions (operate on active tab)
  setBuffer: (buffer: BinaryBuffer, fileName?: string) => void;
  clearBuffer: () => void;
  setCursorPosition: (position: number) => void;
  setSelection: (start: number, end: number) => void;
  setScrollOffset: (offset: number) => void;
  setBytesPerLine: (count: number) => void;
  setIsEditing: (editing: boolean) => void;
  setEditNibble: (nibble: 'high' | 'low') => void;
  setByte: (offset: number, value: number) => void;
  setModified: (modified: boolean) => void;
  resizeBuffer: (newSize: number) => void;
  clearMarkers: () => void;
  swapBytes: () => void;
  fillSelection: (sequence: number[], xor?: boolean) => void;

  // Master tab actions
  setMasterTab: (enabled: boolean) => void;
  getColorBuffer: () => BinaryBuffer | null;
}

function deriveFromTab(tab: Tab | undefined) {
  if (!tab) {
    return {
      buffer: null,
      fileName: null,
      isModified: false,
      scrollOffset: 0,
      cursorPosition: 0,
      selection: { start: 0, end: 0 },
      isEditing: false,
      editNibble: 'high' as const,
    };
  }
  return {
    buffer: tab.buffer,
    fileName: tab.fileName,
    isModified: tab.isModified,
    scrollOffset: tab.scrollOffset,
    cursorPosition: tab.cursorPosition,
    selection: tab.selection,
    isEditing: tab.isEditing,
    editNibble: tab.editNibble,
  };
}

/** Save active tab's mutable view state back into the tabs array */
function saveActiveTab(state: HexEditorState): Tab[] {
  const { tabs, activeTabIndex } = state;
  if (activeTabIndex < 0 || activeTabIndex >= tabs.length) return tabs;
  const updated = [...tabs];
  updated[activeTabIndex] = {
    ...updated[activeTabIndex],
    cursorPosition: state.cursorPosition,
    scrollOffset: state.scrollOffset,
    selection: state.selection,
    isEditing: state.isEditing,
    editNibble: state.editNibble,
    isModified: state.isModified,
  };
  return updated;
}

export const useHexEditorStore = create<HexEditorState>((set, get) => ({
  // Initial state
  tabs: [],
  activeTabIndex: -1,
  masterTabId: null,
  buffer: null,
  fileName: null,
  isModified: false,
  bytesPerLine: 16,
  scrollOffset: 0,
  cursorPosition: 0,
  selection: { start: 0, end: 0 },
  isEditing: false,
  editNibble: 'high',
  renderKey: 0,

  // Tab actions
  addTab: (buffer: BinaryBuffer, fileName?: string) => {
    const state = get();
    const tabs = saveActiveTab(state);
    const tab = createTab(buffer, fileName ?? 'untitled.bin');
    const newTabs = [...tabs, tab];
    const newIndex = newTabs.length - 1;
    set({
      tabs: newTabs,
      activeTabIndex: newIndex,
      ...deriveFromTab(tab),
    });
  },

  removeTab: (index: number) => {
    const state = get();
    const tabs = saveActiveTab(state);
    if (index < 0 || index >= tabs.length) return;
    const removedId = tabs[index].id;
    const newTabs = tabs.filter((_, i) => i !== index);
    const masterTabId = state.masterTabId === removedId ? null : state.masterTabId;
    let newIndex = state.activeTabIndex;
    if (newTabs.length === 0) {
      set({
        tabs: [],
        activeTabIndex: -1,
        masterTabId: null,
        ...deriveFromTab(undefined),
      });
      return;
    }
    if (index <= newIndex) {
      newIndex = Math.max(0, newIndex - 1);
    }
    // If we're at the end, clamp
    newIndex = Math.min(newIndex, newTabs.length - 1);
    set({
      tabs: newTabs,
      activeTabIndex: newIndex,
      masterTabId,
      ...deriveFromTab(newTabs[newIndex]),
    });
  },

  switchTab: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.tabs.length || index === state.activeTabIndex) return;
    const tabs = saveActiveTab(state);
    set({
      tabs,
      activeTabIndex: index,
      ...deriveFromTab(tabs[index]),
    });
  },

  // Compare active tab against another tab, marking differences
  compareToTab: (targetIndex: number) => {
    const state = get();
    const { activeTabIndex, tabs } = state;
    if (
      targetIndex < 0 ||
      targetIndex >= tabs.length ||
      targetIndex === activeTabIndex ||
      activeTabIndex < 0
    )
      return;
    const source = tabs[targetIndex].buffer;
    const active = tabs[activeTabIndex].buffer;
    // Clear existing marks on active buffer, then mark diffs
    active.clearMarkers();
    source.compareToBuffer(active);
    // Bump renderKey to force hex view repaint
    set({ renderKey: state.renderKey + 1 });
  },

  // setBuffer now adds a new tab (used by file handler)
  setBuffer: (buffer: BinaryBuffer, fileName?: string) => {
    get().addTab(buffer, fileName);
  },

  clearBuffer: () => {
    const state = get();
    if (state.activeTabIndex >= 0) {
      state.removeTab(state.activeTabIndex);
    }
  },

  setCursorPosition: (position: number) => {
    const { buffer } = get();
    const maxPos = buffer ? buffer.length - 1 : 0;
    const clampedPosition = Math.max(0, Math.min(position, maxPos));
    set({ cursorPosition: clampedPosition });
  },

  setSelection: (start: number, end: number) =>
    set({ selection: { start, end } }),

  setScrollOffset: (offset: number) => set({ scrollOffset: offset }),

  setBytesPerLine: (count: number) => set({ bytesPerLine: count }),

  setIsEditing: (editing: boolean) =>
    set({ isEditing: editing, editNibble: 'high' }),

  setEditNibble: (nibble: 'high' | 'low') => set({ editNibble: nibble }),

  setByte: (offset: number, value: number) => {
    const { buffer } = get();
    if (buffer && offset >= 0 && offset < buffer.length) {
      buffer.setByte(offset, value);
      set({ isModified: true });
    }
  },

  setModified: (modified: boolean) => set({ isModified: modified }),

  resizeBuffer: (newSize: number) => {
    const { buffer } = get();
    if (!buffer || newSize <= 0) return;
    buffer.resize(newSize);
    const maxPos = Math.max(0, newSize - 1);
    set({
      isModified: true,
      cursorPosition: Math.min(get().cursorPosition, maxPos),
      scrollOffset: Math.min(get().scrollOffset, Math.max(0, newSize - 1)),
      selection: { start: 0, end: 0 },
      renderKey: get().renderKey + 1,
    });
  },

  clearMarkers: () => {
    const { buffer } = get();
    if (!buffer) return;
    buffer.clearMarkers();
    set({ renderKey: get().renderKey + 1 });
  },

  swapBytes: () => {
    const { buffer } = get();
    if (!buffer) return;
    buffer.swapBytes();
    set({ isModified: true, renderKey: get().renderKey + 1 });
  },

  fillSelection: (sequence: number[], xor: boolean = false) => {
    const { buffer, selection, cursorPosition } = get();
    if (!buffer || sequence.length === 0) return;
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selection.start, selection.end);
    const start = selStart === selEnd ? cursorPosition : selStart;
    const end = selStart === selEnd ? buffer.length - 1 : selEnd;
    buffer.fillWithSequence(start, end, sequence, xor);
    set({ isModified: true, renderKey: get().renderKey + 1 });
  },

  setMasterTab: (enabled: boolean) => {
    const state = get();
    if (enabled && state.buffer) {
      set({ masterTabId: state.tabs[state.activeTabIndex]?.id ?? null });
    } else {
      set({ masterTabId: null });
    }
    set({ renderKey: get().renderKey + 1 });
  },

  getColorBuffer: () => {
    const state = get();
    if (state.masterTabId) {
      const masterTab = state.tabs.find(t => t.id === state.masterTabId);
      if (masterTab) return masterTab.buffer;
    }
    return state.buffer;
  },
}));

export default useHexEditorStore;
