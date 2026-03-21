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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);

  // Cell sizing
  const cellSize = 6;
  const cellGap = 1;

  const dataLength = changeCounts?.length ?? 0;

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

  // Draw heatmap canvas
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !changeCounts || dataLength === 0) return;

    const containerWidth = canvas.parentElement?.clientWidth ?? 300;
    const cols = Math.max(1, Math.floor(containerWidth / (cellSize + cellGap)));
    const rows = Math.ceil(dataLength / cols);

    canvas.width = cols * (cellSize + cellGap);
    canvas.height = rows * (cellSize + cellGap);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pre-compute color LUT for all possible change counts
    const colorLUT = new Array<string>(maxChanges + 1);
    for (let c = 0; c <= maxChanges; c++) {
      colorLUT[c] = heatColor(c, maxChanges);
    }

    for (let i = 0; i < dataLength; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + cellGap);
      const y = row * (cellSize + cellGap);

      ctx.fillStyle = colorLUT[changeCounts[i]];
      ctx.fillRect(x, y, cellSize, cellSize);

      if (i === selectedOffset) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, cellSize + 1, cellSize + 1);
      }
    }
  }, [changeCounts, dataLength, maxChanges, selectedOffset, cellSize, cellGap]);

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
      const cols = Math.max(1, Math.floor(canvas.width / (cellSize + cellGap)));
      const col = Math.floor(x / (cellSize + cellGap));
      const row = Math.floor(y / (cellSize + cellGap));
      const offset = row * cols + col;
      if (offset >= 0 && offset < dataLength) {
        setSelectedOffset(offset);
        setCursorPosition(offset);
      }
    },
    [dataLength, cellSize, cellGap, setCursorPosition],
  );

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cols = Math.max(1, Math.floor(canvas.width / (cellSize + cellGap)));
      const col = Math.floor(x / (cellSize + cellGap));
      const row = Math.floor(y / (cellSize + cellGap));
      const offset = row * cols + col;
      if (offset >= 0 && offset < dataLength) {
        setHoveredOffset(offset);
      } else {
        setHoveredOffset(null);
      }
    },
    [dataLength, cellSize, cellGap],
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
          {changedCount} differ
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
});

export default HeatmapPanel;
