import React, {useEffect, useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useHexEditorStore} from '@shared/contexts/hex-editor-store';
import {useTranslation} from '@shared/locales';

function heatColorRGB(changeCount: number, maxChanges: number): string {
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

const CELL_SIZE = 6;
const CELL_GAP = 1;
const STEP = CELL_SIZE + CELL_GAP;

const HeatmapGrid = React.memo(function HeatmapGrid({
  changeCounts,
  maxChanges,
  cols,
}: {
  changeCounts: Uint16Array;
  maxChanges: number;
  cols: number;
}) {
  const dataLength = changeCounts.length;
  const totalRows = Math.ceil(dataLength / cols);

  const colorLUT = useMemo(() => {
    const lut: string[] = new Array(maxChanges + 1);
    for (let c = 0; c <= maxChanges; c++) {
      lut[c] = heatColorRGB(c, maxChanges);
    }
    return lut;
  }, [maxChanges]);

  const rows = useMemo(() => {
    const result: React.ReactNode[] = [];
    for (let row = 0; row < totalRows; row++) {
      const cells: React.ReactNode[] = [];
      const count = Math.min(cols, dataLength - row * cols);
      for (let col = 0; col < count; col++) {
        const idx = row * cols + col;
        const color = colorLUT[changeCounts[idx]] ?? '#1a1a2e';
        cells.push(
          <View key={col} style={[styles.cell, {backgroundColor: color}]} />,
        );
      }
      result.push(
        <View key={row} style={styles.gridRow}>
          {cells}
        </View>,
      );
    }
    return result;
  }, [changeCounts, colorLUT, cols, dataLength, totalRows]);

  return (
    <ScrollView style={styles.gridWrap}>
      <View
        style={[
          styles.grid,
          {width: cols * STEP + CELL_GAP, backgroundColor: '#0d0d1a'},
        ]}>
        {rows}
      </View>
    </ScrollView>
  );
});

export function HeatmapPanel() {
  const {t} = useTranslation();
  const tabCount = useHexEditorStore(s => s.tabs.length);
  const updateHeatmap = useHexEditorStore(s => s.updateHeatmap);
  const changeCounts = useHexEditorStore(s => s.heatmapChangeCounts);
  const maxChanges = useHexEditorStore(s => s.heatmapMaxChanges);
  const bytesPerLine = useHexEditorStore(s => s.bytesPerLine);

  const dataLength = changeCounts?.length ?? 0;

  // Trigger comparison on mount / tab change
  useEffect(() => {
    updateHeatmap();
    return () => {
      useHexEditorStore.setState({
        heatmapChangeCounts: null,
        heatmapMaxChanges: 0,
      });
    };
  }, [tabCount, updateHeatmap]);

  // Summary stats
  const changedCount = useMemo(() => {
    if (!changeCounts) return 0;
    let count = 0;
    for (let i = 0; i < changeCounts.length; i++) {
      if (changeCounts[i] > 0) count++;
    }
    return count;
  }, [changeCounts]);

  if (tabCount < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>{t('heatmapEmpty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('heatmapCompare')}</Text>
        <Text style={styles.subtitle}>
          {t('heatmapSubtitle', {
            tabCount,
            byteCount: dataLength,
            diffCount: changedCount,
          })}
        </Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, {backgroundColor: '#1a1a2e'}]} />
          <Text style={styles.legendLabel}>{t('noChange')}</Text>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[
              styles.legendSwatch,
              {
                backgroundColor: heatColorRGB(
                  Math.ceil(maxChanges * 0.5),
                  maxChanges,
                ),
              },
            ]}
          />
          <Text style={styles.legendLabel}>{t('some')}</Text>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[
              styles.legendSwatch,
              {backgroundColor: heatColorRGB(maxChanges, maxChanges)},
            ]}
          />
          <Text style={styles.legendLabel}>{t('allDiffer')}</Text>
        </View>
      </View>

      {changeCounts && maxChanges > 0 && (
        <HeatmapGrid
          changeCounts={changeCounts}
          maxChanges={maxChanges}
          cols={bytesPerLine}
        />
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
  gridWrap: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  grid: {
    padding: CELL_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginRight: CELL_GAP,
  },
});
