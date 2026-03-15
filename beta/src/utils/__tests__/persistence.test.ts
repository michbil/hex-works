import 'fake-indexeddb/auto';
import { saveTabs, loadTabs } from '../persistence';
import { BinaryBuffer } from '../binbuf';

// Reset IndexedDB between tests by deleting the known DB
beforeEach(() => {
  indexedDB.deleteDatabase('localforage');
});

function makeTab(name: string, data: number[]) {
  const buf = new BinaryBuffer(data);
  buf.name = name;
  return { id: buf.uuid, buffer: buf, fileName: name };
}

describe('saveTabs / loadTabs', () => {
  it('round-trips tabs through IndexedDB', async () => {
    const tab = makeTab('test.bin', [0xca, 0xfe]);
    await saveTabs([tab], 0);
    const result = await loadTabs();
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].fileName).toBe('test.bin');
    expect(result!.tabs[0].buffer.getByte(0)).toBe(0xca);
    expect(result!.tabs[0].buffer.getByte(1)).toBe(0xfe);
  });

  it('preserves tab order', async () => {
    const tab1 = makeTab('first.bin', [0x01]);
    const tab2 = makeTab('second.bin', [0x02]);
    await saveTabs([tab1, tab2], 1);
    const result = await loadTabs();
    expect(result!.tabs[0].fileName).toBe('first.bin');
    expect(result!.tabs[1].fileName).toBe('second.bin');
  });

  it('preserves colors as Uint8Array', async () => {
    const tab = makeTab('colors.bin', [0x01, 0x02]);
    tab.buffer.setColor(0, 3);
    tab.buffer.setColor(1, 5);
    await saveTabs([tab], 0);
    const result = await loadTabs();
    expect(result!.tabs[0].buffer.getColor(0)).toBe(3);
    expect(result!.tabs[0].buffer.getColor(1)).toBe(5);
  });

  it('preserves active index', async () => {
    const tab1 = makeTab('a.bin', [0x01]);
    const tab2 = makeTab('b.bin', [0x02]);
    await saveTabs([tab1, tab2], 1);
    const result = await loadTabs();
    expect(result!.activeIndex).toBe(1);
  });

  it('returns null for empty DB', async () => {
    const result = await loadTabs();
    expect(result).toBeNull();
  });

  it('cleans up removed tabs', async () => {
    const tab1 = makeTab('keep.bin', [0x01]);
    const tab2 = makeTab('remove.bin', [0x02]);
    // Save both tabs first
    await saveTabs([tab1, tab2], 0);
    // Now save only tab1 — tab2 should be cleaned up
    await saveTabs([tab1], 0);
    const result = await loadTabs();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].fileName).toBe('keep.bin');
  });
});
