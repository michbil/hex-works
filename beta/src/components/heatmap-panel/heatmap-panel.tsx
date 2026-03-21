/**
 * HeatmapPanel — Multi-dump EEPROM comparison tool.
 *
 * Compares all open tabs byte-by-byte and renders:
 *  1. A canvas heatmap where each cell = one byte address,
 *     colored by how many tabs differ at that offset.
 *  2. A detail inspector for the selected address showing each
 *     tab's value and interpretation.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { BinaryBuffer } from '../../utils/binbuf';

// Heatmap color scale: 0 changes → dark, max changes → bright red
function heatColor(changeCount: number, maxChanges: number): string {
  if (maxChanges === 0 || changeCount === 0) return '#1a1a2e';
  const t = changeCount / maxChanges;
  if (t <= 0.5) {
    const s = t * 2;
    const r = Math.round(30 + s * 225);
    const g = Math.round(30 + s * 195);
    const b = Math.round(80 * (1 - s));
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) * 2;
  const r = 255;
  const g = Math.round(225 * (1 - s));
  return `rgb(${r},${g},0)`;
}

export function HeatmapPanel({ onClose }: { onClose?: () => void }) {
  const tabs = useHexEditorStore((s) => s.tabs);
  const setCursorPosition = useHexEditorStore((s) => s.setCursorPosition);
  const setSelection = useHexEditorStore((s) => s.setSelection);
  const updateHeatmap = useHexEditorStore((s) => s.updateHeatmap);
  const changeCounts = useHexEditorStore((s) => s.heatmapChangeCounts);
  const maxChanges = useHexEditorStore((s) => s.heatmapMaxChanges);
  const bytesPerLine = useHexEditorStore((s) => s.bytesPerLine);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<View>(null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);
  const [heatScrollRow, setHeatScrollRow] = useState(0);
  const [wrapHeight, setWrapHeight] = useState(0);

  // Fixed columns matching hex dump layout
  const cols = bytesPerLine;
  const cellSize = 6;
  const cellGap = 1;
  const step = cellSize + cellGap;

  const dataLength = changeCounts?.length ?? 0;
  const totalRows = Math.ceil(dataLength / cols);

  // Derive visible rows from measured wrapper height
  const visibleRows = wrapHeight > 0 ? Math.max(1, Math.floor(wrapHeight / step)) : 16;
  const maxScrollRow = Math.max(0, totalRows - visibleRows);

  // Compute summary stats once
  const changedCount = useMemo(() => {
    if (!changeCounts) return 0;
    let count = 0;
    for (let i = 0; i < changeCounts.length; i++) {
      if (changeCounts[i] > 0) count++;
    }
    return count;
  }, [changeCounts]);

  // Push comparison data to store so hex-view can render inline heatmap
  useEffect(() => {
    updateHeatmap();
    return () => {
      useHexEditorStore.setState({ heatmapChangeCounts: null, heatmapMaxChanges: 0 });
    };
  }, [tabs, updateHeatmap]);

  // Enable scroll sync while heatmap panel is open
  useEffect(() => {
    useHexEditorStore.getState().setSyncScroll(true);
    return () => {
      useHexEditorStore.getState().setSyncScroll(false);
    };
  }, []);

  // Pre-compute RGB LUT for each possible changeCount
  const colorLUT = useMemo(() => {
    if (maxChanges === 0) return null;
    // Store [r, g, b] per count
    const lut = new Uint8Array((maxChanges + 1) * 3);
    for (let c = 0; c <= maxChanges; c++) {
      const off = c * 3;
      if (c === 0) {
        lut[off] = 26; lut[off + 1] = 26; lut[off + 2] = 46; // #1a1a2e
      } else {
        const t = c / maxChanges;
        if (t <= 0.5) {
          const s = t * 2;
          lut[off]     = Math.round(30 + s * 225);
          lut[off + 1] = Math.round(30 + s * 195);
          lut[off + 2] = Math.round(80 * (1 - s));
        } else {
          const s = (t - 0.5) * 2;
          lut[off]     = 255;
          lut[off + 1] = Math.round(225 * (1 - s));
          lut[off + 2] = 0;
        }
      }
    }
    return lut;
  }, [maxChanges]);

  // Draw heatmap canvas — grid with gaps, fills available height
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !changeCounts || dataLength === 0 || !colorLUT) return;

    const w = cols * step + cellGap;
    const h = visibleRows * step + cellGap;
    canvas.width = w;
    canvas.height = h;

    // CSS: stretch to fill wrapper
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background (gap color)
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, w, h);

    // Pre-build fillStyle strings from LUT
    const colorStrings = new Array<string>(maxChanges + 1);
    for (let i = 0; i <= maxChanges; i++) {
      const off = i * 3;
      colorStrings[i] = `rgb(${colorLUT[off]},${colorLUT[off + 1]},${colorLUT[off + 2]})`;
    }

    const startByte = heatScrollRow * cols;

    for (let r = 0; r < visibleRows; r++) {
      const y = cellGap + r * step;
      for (let c = 0; c < cols; c++) {
        const byteIdx = startByte + r * cols + c;
        const x = cellGap + c * step;
        if (byteIdx < dataLength) {
          ctx.fillStyle = colorStrings[changeCounts[byteIdx]];
        } else {
          ctx.fillStyle = '#1a1a2e';
        }
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    // Draw selection highlight if visible
    if (selectedOffset !== null && selectedOffset < dataLength) {
      const selRow = Math.floor(selectedOffset / cols) - heatScrollRow;
      const selCol = selectedOffset % cols;
      if (selRow >= 0 && selRow < visibleRows) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        const x = cellGap + selCol * step;
        const y = cellGap + selRow * step;
        ctx.strokeRect(x - 0.5, y - 0.5, cellSize + 1, cellSize + 1);
      }
    }
  }, [changeCounts, dataLength, maxChanges, selectedOffset, cols, visibleRows, colorLUT, heatScrollRow, step, cellSize, cellGap]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  // Map mouse position to byte offset (CSS-scaled canvas + scroll)
  const mouseToOffset = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): number => {
      const canvas = canvasRef.current;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      // Map CSS coords to canvas coords, then to cell
      const cx = (e.clientX - rect.left) / rect.width * canvas.width;
      const cy = (e.clientY - rect.top) / rect.height * canvas.height;
      const col = Math.floor((cx - cellGap) / step);
      const row = Math.floor((cy - cellGap) / step);
      if (col < 0 || col >= cols || row < 0 || row >= visibleRows) return -1;
      return (heatScrollRow + row) * cols + col;
    },
    [cols, visibleRows, heatScrollRow, step, cellGap],
  );

  // Mouse wheel scrolling
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      setHeatScrollRow((prev) => {
        const delta = e.deltaY > 0 ? 1 : -1;
        return Math.max(0, Math.min(maxScrollRow, prev + delta));
      });
    },
    [maxScrollRow],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const offset = mouseToOffset(e);
      if (offset >= 0 && offset < dataLength) {
        setSelectedOffset(offset);
        setCursorPosition(offset);
      }
    },
    [dataLength, mouseToOffset, setCursorPosition],
  );

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const offset = mouseToOffset(e);
      if (offset >= 0 && offset < dataLength) {
        setHoveredOffset(offset);
      } else {
        setHoveredOffset(null);
      }
    },
    [dataLength, mouseToOffset],
  );

  const goToOffset = useCallback(
    (offset: number) => {
      setSelectedOffset(offset);
      setCursorPosition(offset);
      setSelection(offset, offset);
    },
    [setCursorPosition, setSelection],
  );

  const toHex = (v: number, pad: number) =>
    v >= 0 ? v.toString(16).toUpperCase().padStart(pad, '0') : '--';

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
  // Compute detail data on-demand for just the inspected offset
  const inspectData = inspectOffset !== null && tabs.length >= 2
    ? BinaryBuffer.compareAtOffset(tabs.map((t) => t.buffer), inspectOffset)
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Heatmap Compare</Text>
        <Text style={styles.subtitle}>
          {tabs.length} dumps &middot; {dataLength} bytes &middot;{' '}
          {changedCount} differ &middot; row {heatScrollRow}/{totalRows}
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

      {/* Heatmap canvas — fills remaining vertical space */}
      {Platform.OS === 'web' && (
        <View
          ref={wrapRef}
          style={styles.canvasWrap}
          onLayout={(e) => setWrapHeight(e.nativeEvent.layout.height)}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick as any}
            onMouseMove={handleCanvasMove as any}
            onMouseLeave={() => setHoveredOffset(null)}
            style={{ cursor: 'crosshair', display: 'block' }}
          />
        </View>
      )}

      {/* Detail inspector for hovered/selected offset */}
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
                  <Text style={styles.detailFileName} numberOfLines={1}>
                    {tab.fileName}
                  </Text>
                  <Text style={styles.detailValue}>0x{toHex(val, 2)}</Text>
                  <Text style={styles.detailValue}>{val >= 0 ? val : '--'}</Text>
                  <Text style={styles.detailBits}>
                    {val >= 0 ? val.toString(2).padStart(8, '0') : '--------'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
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
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 8,
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
});

export default HeatmapPanel;
