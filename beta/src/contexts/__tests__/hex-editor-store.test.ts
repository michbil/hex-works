import { useHexEditorStore } from '../hex-editor-store';
import { BinaryBuffer } from '../../utils/binbuf';

const initialState = useHexEditorStore.getState();

beforeEach(() => {
  // Reset store to initial state between tests
  useHexEditorStore.setState(initialState, true);
});

function addTestTab(name = 'test.bin', size = 16): BinaryBuffer {
  const buf = new BinaryBuffer(size);
  buf.name = name;
  useHexEditorStore.getState().addTab(buf, name);
  return buf;
}

describe('addTab', () => {
  it('adds tab and switches to it', () => {
    addTestTab('file1.bin');
    const state = useHexEditorStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabIndex).toBe(0);
    expect(state.fileName).toBe('file1.bin');
  });

  it('sets buffer on state', () => {
    addTestTab();
    const state = useHexEditorStore.getState();
    expect(state.buffer).not.toBeNull();
    expect(state.buffer!.length).toBe(16);
  });

  it('preserves previous tabs', () => {
    addTestTab('file1.bin');
    addTestTab('file2.bin');
    const state = useHexEditorStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(1);
    expect(state.fileName).toBe('file2.bin');
  });

  it('uses "untitled.bin" as default name', () => {
    const buf = new BinaryBuffer(4);
    useHexEditorStore.getState().addTab(buf);
    expect(useHexEditorStore.getState().fileName).toBe('untitled.bin');
  });
});

describe('removeTab', () => {
  it('removes tab and adjusts activeTabIndex', () => {
    addTestTab('file1.bin');
    addTestTab('file2.bin');
    useHexEditorStore.getState().removeTab(0);
    const state = useHexEditorStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.fileName).toBe('file2.bin');
  });

  it('clears masterTabId if removed tab was master', () => {
    addTestTab('file1.bin');
    useHexEditorStore.getState().setMasterTab(true);
    expect(useHexEditorStore.getState().masterTabId).not.toBeNull();
    useHexEditorStore.getState().removeTab(0);
    expect(useHexEditorStore.getState().masterTabId).toBeNull();
  });

  it('handles removing last tab (resets to empty state)', () => {
    addTestTab();
    useHexEditorStore.getState().removeTab(0);
    const state = useHexEditorStore.getState();
    expect(state.tabs).toHaveLength(0);
    expect(state.activeTabIndex).toBe(-1);
    expect(state.buffer).toBeNull();
  });

  it('no-op for out-of-range index', () => {
    addTestTab();
    useHexEditorStore.getState().removeTab(5);
    expect(useHexEditorStore.getState().tabs).toHaveLength(1);
  });
});

describe('switchTab', () => {
  it('switches active tab and derives state', () => {
    addTestTab('file1.bin');
    addTestTab('file2.bin');
    useHexEditorStore.getState().switchTab(0);
    expect(useHexEditorStore.getState().fileName).toBe('file1.bin');
  });

  it('saves cursor/scroll of outgoing tab', () => {
    addTestTab('file1.bin');
    useHexEditorStore.getState().setCursorPosition(5);
    addTestTab('file2.bin');
    // Now on tab 1, switch back to tab 0
    useHexEditorStore.getState().switchTab(0);
    expect(useHexEditorStore.getState().cursorPosition).toBe(5);
  });

  it('no-op for same index', () => {
    addTestTab();
    const stateBefore = useHexEditorStore.getState();
    useHexEditorStore.getState().switchTab(0);
    // activeTabIndex should remain the same
    expect(useHexEditorStore.getState().activeTabIndex).toBe(stateBefore.activeTabIndex);
  });

  it('no-op for out-of-range index', () => {
    addTestTab();
    useHexEditorStore.getState().switchTab(99);
    expect(useHexEditorStore.getState().activeTabIndex).toBe(0);
  });
});

describe('setCursorPosition', () => {
  it('clamps to valid range', () => {
    addTestTab('test.bin', 8);
    useHexEditorStore.getState().setCursorPosition(100);
    expect(useHexEditorStore.getState().cursorPosition).toBe(7);
  });

  it('clamps negative to 0', () => {
    addTestTab();
    useHexEditorStore.getState().setCursorPosition(-5);
    expect(useHexEditorStore.getState().cursorPosition).toBe(0);
  });
});

describe('setByte', () => {
  it('sets byte on active buffer and marks modified', () => {
    addTestTab();
    useHexEditorStore.getState().setByte(0, 0xff);
    const state = useHexEditorStore.getState();
    expect(state.buffer!.getByte(0)).toBe(0xff);
    expect(state.isModified).toBe(true);
  });

  it('no-op when no buffer', () => {
    // No tabs added
    useHexEditorStore.getState().setByte(0, 0xff);
    expect(useHexEditorStore.getState().isModified).toBe(false);
  });
});

describe('resizeBuffer', () => {
  it('resizes buffer and clamps cursor/scroll', () => {
    addTestTab('test.bin', 16);
    useHexEditorStore.getState().setCursorPosition(15);
    useHexEditorStore.getState().resizeBuffer(4);
    const state = useHexEditorStore.getState();
    expect(state.buffer!.length).toBe(4);
    expect(state.cursorPosition).toBe(3);
    expect(state.isModified).toBe(true);
  });

  it('no-op for invalid size', () => {
    addTestTab();
    useHexEditorStore.getState().resizeBuffer(0);
    expect(useHexEditorStore.getState().buffer!.length).toBe(16);
  });

  it('no-op when no buffer', () => {
    useHexEditorStore.getState().resizeBuffer(8);
    // Should not throw
  });
});

describe('fillSelection', () => {
  it('fills selection range with sequence', () => {
    addTestTab('test.bin', 8);
    useHexEditorStore.getState().setSelection(2, 4);
    useHexEditorStore.getState().fillSelection([0xaa]);
    const buf = useHexEditorStore.getState().buffer!;
    expect(buf.getByte(2)).toBe(0xaa);
    expect(buf.getByte(3)).toBe(0xaa);
    expect(buf.getByte(4)).toBe(0xaa);
  });

  it('fills from cursor to end when no selection', () => {
    addTestTab('test.bin', 4);
    useHexEditorStore.getState().setCursorPosition(2);
    useHexEditorStore.getState().setSelection(0, 0);
    useHexEditorStore.getState().fillSelection([0xbb]);
    const buf = useHexEditorStore.getState().buffer!;
    expect(buf.getByte(2)).toBe(0xbb);
    expect(buf.getByte(3)).toBe(0xbb);
  });

  it('supports XOR mode', () => {
    addTestTab('test.bin', 4);
    useHexEditorStore.getState().buffer!.setByte(0, 0xff);
    useHexEditorStore.getState().setSelection(0, 0);
    // Selection start == end, so fills from cursor (0) to end
    useHexEditorStore.getState().setCursorPosition(0);
    useHexEditorStore.getState().fillSelection([0xff], true);
    expect(useHexEditorStore.getState().buffer!.getByte(0)).toBe(0x00);
  });
});

describe('setMasterTab / getColorBuffer', () => {
  it('setMasterTab(true) sets masterTabId to active tab', () => {
    addTestTab();
    useHexEditorStore.getState().setMasterTab(true);
    expect(useHexEditorStore.getState().masterTabId).not.toBeNull();
  });

  it('setMasterTab(false) clears masterTabId', () => {
    addTestTab();
    useHexEditorStore.getState().setMasterTab(true);
    useHexEditorStore.getState().setMasterTab(false);
    expect(useHexEditorStore.getState().masterTabId).toBeNull();
  });

  it('getColorBuffer returns master tab buffer when set', () => {
    addTestTab('master.bin', 8);
    const masterBuf = useHexEditorStore.getState().buffer!;
    useHexEditorStore.getState().setMasterTab(true);
    addTestTab('other.bin', 4);
    // Active tab is now "other.bin", but color buffer should be master
    const colorBuf = useHexEditorStore.getState().getColorBuffer();
    expect(colorBuf).toBe(masterBuf);
  });

  it('getColorBuffer returns active buffer when no master', () => {
    addTestTab();
    const activeBuf = useHexEditorStore.getState().buffer;
    expect(useHexEditorStore.getState().getColorBuffer()).toBe(activeBuf);
  });
});

describe('compareToTab', () => {
  it('marks differences between active and target tab', () => {
    const buf1 = new BinaryBuffer([0x01, 0x02, 0x03]);
    useHexEditorStore.getState().addTab(buf1, 'a.bin');
    const buf2 = new BinaryBuffer([0x01, 0x99, 0x03]);
    useHexEditorStore.getState().addTab(buf2, 'b.bin');
    // Active is tab 1 (b.bin), compare against tab 0 (a.bin)
    useHexEditorStore.getState().compareToTab(0);
    const activeBuf = useHexEditorStore.getState().buffer!;
    expect(activeBuf.isMarked(0)).toBe(false);
    expect(activeBuf.isMarked(1)).toBe(true);
    expect(activeBuf.isMarked(2)).toBe(false);
  });
});

describe('swapBytes', () => {
  it('swaps bytes on active buffer', () => {
    const buf = new BinaryBuffer([0x01, 0x02]);
    useHexEditorStore.getState().addTab(buf, 'test.bin');
    useHexEditorStore.getState().swapBytes();
    expect(useHexEditorStore.getState().buffer!.getByte(0)).toBe(0x02);
    expect(useHexEditorStore.getState().buffer!.getByte(1)).toBe(0x01);
  });
});
