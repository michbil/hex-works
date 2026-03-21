/**
 * HeatmapPanel — Multi-dump EEPROM comparison tool.
 *
 * Compares all open tabs byte-by-byte and renders:
 *  1. A canvas heatmap where each cell = one byte address,
 *     colored by how many tabs differ at that offset.
 *  2. A detail table for the selected address showing each
 *     tab's value and interpretation.
 *  3. A filterable list of only the addresses that changed.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { BinaryBuffer } from '../../utils/binbuf';

// Heatmap color scale: 0 changes → dark, max changes → bright red
function heatColor(changeCount: number, maxChanges: number): string {
  if (maxChanges === 0 || changeCount === 0) return '#1a1a2e';
  const t = changeCount / maxChanges;
  // Interpolate: dark blue → yellow → red
  if (t <= 0.5) {
    const s = t * 2;
    const r = Math.round(30 + s * 225);
    const g = Math.round(30 + s * 195);
    const b = Math.round(80 * (1 - s));
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) * 2;
  const r = Math.round(255);
  const g = Math.round(225 * (1 - s));
  const b = 0;
  return `rgb(${r},${g},${b})`;
}

type FilterMode = 'all' | 'changed' | 'constant';

interface DiffEntry {
  offset: number;
  uniqueValues: number;
  min: number;
  max: number;
  values: number[];
  changeCount: number;
}

export function HeatmapPanel({ onClose }: { onClose?: () => void }) {
  const tabs = useHexEditorStore((s) => s.tabs);
  const setCursorPosition = useHexEditorStore((s) => s.setCursorPosition);
  const setSelection = useHexEditorStore((s) => s.setSelection);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('changed');
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);

  // Cell sizing
  const cellSize = 6;
  const cellGap = 1;

  // Compute diff data across all tabs
  const diffData = useMemo(() => {
    if (tabs.length < 2) return [];
    const buffers = tabs.map((t) => t.buffer);
    return BinaryBuffer.compareMultiple(buffers);
  }, [tabs]);

  const maxChanges = useMemo(
    () => Math.max(1, ...diffData.map((d) => d.changeCount)),
    [diffData],
  );

  // Filtered list for the table
  const filteredEntries = useMemo(() => {
    return diffData
      .map((d, i) => ({ offset: i, ...d }))
      .filter((d) => {
        if (filterMode === 'changed') return d.changeCount > 0;
        if (filterMode === 'constant') return d.changeCount === 0;
        return true;
      });
  }, [diffData, filterMode]);

  // Draw heatmap canvas
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || diffData.length === 0) return;

    const containerWidth = canvas.parentElement?.clientWidth ?? 300;
    const cols = Math.max(1, Math.floor(containerWidth / (cellSize + cellGap)));
    const rows = Math.ceil(diffData.length / cols);

    canvas.width = cols * (cellSize + cellGap);
    canvas.height = rows * (cellSize + cellGap);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < diffData.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + cellGap);
      const y = row * (cellSize + cellGap);

      ctx.fillStyle = heatColor(diffData[i].changeCount, maxChanges);
      ctx.fillRect(x, y, cellSize, cellSize);

      // Highlight selected
      if (i === selectedOffset) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, cellSize + 1, cellSize + 1);
      }
    }
  }, [diffData, maxChanges, selectedOffset, cellSize, cellGap]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cols = Math.max(
        1,
        Math.floor(canvas.width / (cellSize + cellGap)),
      );
      const col = Math.floor(x / (cellSize + cellGap));
      const row = Math.floor(y / (cellSize + cellGap));
      const offset = row * cols + col;
      if (offset >= 0 && offset < diffData.length) {
        setSelectedOffset(offset);
        setCursorPosition(offset);
      }
    },
    [diffData.length, cellSize, cellGap, setCursorPosition],
  );

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cols = Math.max(
        1,
        Math.floor(canvas.width / (cellSize + cellGap)),
      );
      const col = Math.floor(x / (cellSize + cellGap));
      const row = Math.floor(y / (cellSize + cellGap));
      const offset = row * cols + col;
      if (offset >= 0 && offset < diffData.length) {
        setHoveredOffset(offset);
      } else {
        setHoveredOffset(null);
      }
    },
    [diffData.length, cellSize, cellGap],
  );

  // Navigate hex view to an address from the table
  const goToOffset = useCallback(
    (offset: number) => {
      setSelectedOffset(offset);
      setCursorPosition(offset);
      setSelection(offset, offset);
    },
    [setCursorPosition, setSelection],
  );

  const toHex = (v: number, pad: number) =>
    v >= 0
      ? v.toString(16).toUpperCase().padStart(pad, '0')
      : '--';

  if (tabs.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>
          Open 2+ dumps in separate tabs to compare.{'\n'}
          Right-click the tab bar to load files.
        </Text>
      </View>
    );
  }

  const inspectOffset = selectedOffset ?? hoveredOffset;
  const inspectData = inspectOffset !== null ? diffData[inspectOffset] : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Heatmap Compare</Text>
        <Text style={styles.subtitle}>
          {tabs.length} dumps &middot; {diffData.length} bytes &middot;{' '}
          {diffData.filter((d) => d.changeCount > 0).length} differ
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: '#1a1a2e' }]} />
          <Text style={styles.legendLabel}>No change</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: heatColor(Math.ceil(maxChanges * 0.5), maxChanges) }]} />
          <Text style={styles.legendLabel}>Some</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: heatColor(maxChanges, maxChanges) }]} />
          <Text style={styles.legendLabel}>All differ</Text>
        </View>
      </View>

      {/* Heatmap canvas */}
      {Platform.OS === 'web' && (
        <View style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick as any}
            onMouseMove={handleCanvasMove as any}
            onMouseLeave={() => setHoveredOffset(null)}
            style={{ cursor: 'crosshair', display: 'block' }}
          />
        </View>
      )}

      {/* Tooltip for hovered/selected offset */}
      {inspectData && inspectOffset !== null && (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            Offset 0x{toHex(inspectOffset, 4)} &middot;{' '}
            {inspectData.changeCount}/{tabs.length - 1} differ &middot;{' '}
            {inspectData.uniqueValues} unique
          </Text>
          <View style={styles.detailTable}>
            {tabs.map((tab, i) => {
              const val = inspectData.values[i];
              const differs = i > 0 && val !== inspectData.values[0];
              return (
                <View
                  key={tab.id}
                  style={[styles.detailRow, differs && styles.detailRowDiff]}
                >
                  <Text
                    style={styles.detailFileName}
                    numberOfLines={1}
                  >
                    {tab.fileName}
                  </Text>
                  <Text style={styles.detailValue}>
                    0x{toHex(val, 2)}
                  </Text>
                  <Text style={styles.detailValue}>
                    {val >= 0 ? val : '--'}
                  </Text>
                  <Text style={styles.detailBits}>
                    {val >= 0 ? val.toString(2).padStart(8, '0') : '--------'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {(['changed', 'all', 'constant'] as FilterMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterBtn, filterMode === mode && styles.filterBtnActive]}
            onPress={() => setFilterMode(mode)}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterMode === mode && styles.filterBtnTextActive,
              ]}
            >
              {mode === 'changed'
                ? `Changed (${diffData.filter((d) => d.changeCount > 0).length})`
                : mode === 'constant'
                  ? `Constant (${diffData.filter((d) => d.changeCount === 0).length})`
                  : `All (${diffData.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Address table */}
      <ScrollView style={styles.tableScroll}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableCellAddr]}>Address</Text>
          {tabs.map((tab) => (
            <Text key={tab.id} style={[styles.tableCell, styles.tableCellVal]} numberOfLines={1}>
              {tab.fileName.slice(0, 10)}
            </Text>
          ))}
          <Text style={[styles.tableCell, styles.tableCellVal]}>Unique</Text>
        </View>
        {filteredEntries.slice(0, 500).map((entry) => (
          <TouchableOpacity
            key={entry.offset}
            style={[
              styles.tableRow,
              entry.offset === selectedOffset && styles.tableRowSelected,
            ]}
            onPress={() => goToOffset(entry.offset)}
          >
            <Text style={[styles.tableCell, styles.tableCellAddr]}>
              0x{toHex(entry.offset, 4)}
            </Text>
            {entry.values.map((val, i) => {
              const differs = i > 0 && val !== entry.values[0];
              return (
                <Text
                  key={i}
                  style={[
                    styles.tableCell,
                    styles.tableCellVal,
                    differs && styles.tableCellDiff,
                  ]}
                >
                  {toHex(val, 2)}
                </Text>
              );
            })}
            <Text style={[styles.tableCell, styles.tableCellVal]}>
              {entry.uniqueValues}
            </Text>
          </TouchableOpacity>
        ))}
        {filteredEntries.length > 500 && (
          <Text style={styles.truncated}>
            Showing 500 / {filteredEntries.length} entries
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  placeholder: {
    color: '#6c757d',
    fontSize: 13,
    padding: 16,
    textAlign: 'center',
  },
  header: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLabel: {
    color: '#aaa',
    fontSize: 10,
  },
  canvasWrap: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    maxHeight: 160,
    overflow: 'hidden',
  },
  detail: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailTitle: {
    color: '#e0e0e0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailTable: {
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 8,
  },
  detailRowDiff: {
    backgroundColor: 'rgba(229,115,115,0.15)',
  },
  detailFileName: {
    color: '#aaa',
    fontSize: 11,
    width: 80,
  },
  detailValue: {
    color: '#e0e0e0',
    fontSize: 11,
    fontFamily: 'monospace',
    width: 36,
    textAlign: 'right',
  },
  detailBits: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: '#2a2a3a',
  },
  filterBtnActive: {
    backgroundColor: '#007bff',
  },
  filterBtnText: {
    color: '#aaa',
    fontSize: 11,
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  tableScroll: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#252535',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  tableRowSelected: {
    backgroundColor: 'rgba(0,123,255,0.2)',
  },
  tableCell: {
    color: '#ccc',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  tableCellAddr: {
    width: 56,
    fontWeight: '600',
  },
  tableCellVal: {
    width: 40,
    textAlign: 'center',
  },
  tableCellDiff: {
    color: '#E57373',
    fontWeight: '600',
  },
  truncated: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    padding: 8,
  },
});

export default HeatmapPanel;
