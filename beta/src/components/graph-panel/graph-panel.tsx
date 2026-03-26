import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useHexEditorStore } from "../../contexts/hex-editor-store";
import { useTranslation } from "../../locales";
import type { ChartOptions } from "chart.js";
import type { BinaryBuffer } from "../../utils/binbuf";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

type GraphType = "line" | "bar" | "histogram";
type DataFormat = "uint8" | "int8" | "uint16le" | "uint16be" | "float32le";

let ChartRegistered = false;

if (Platform.OS === "web") {
  try {
    if (!ChartRegistered) {
      Chart.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        Tooltip,
        Legend,
        Filler,
      );
      ChartRegistered = true;
    }
  } catch {
    // chart.js not available
  }
}

function getSelectedBytes(
  buffer: BinaryBuffer | null,
  selection: { start: number; end: number },
): Uint8Array | null {
  if (!buffer) return null;
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  if (start === end) return null;
  const count = end - start + 1;
  if (count < 2) return null;
  const bytes = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    bytes[i] = buffer.getByte(start + i);
  }
  return bytes;
}

function interpretData(raw: Uint8Array, format: DataFormat): number[] {
  switch (format) {
    case "uint8":
      return Array.from(raw);
    case "int8":
      return Array.from(raw).map((b) => (b > 127 ? b - 256 : b));
    case "uint16le": {
      const values: number[] = [];
      for (let i = 0; i + 1 < raw.length; i += 2) {
        values.push(raw[i] | (raw[i + 1] << 8));
      }
      return values;
    }
    case "uint16be": {
      const values: number[] = [];
      for (let i = 0; i + 1 < raw.length; i += 2) {
        values.push((raw[i] << 8) | raw[i + 1]);
      }
      return values;
    }
    case "float32le": {
      const values: number[] = [];
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let i = 0; i + 3 < raw.length; i += 4) {
        values.push(dv.getFloat32(i, true));
      }
      return values;
    }
  }
}

function buildHistogram(
  values: number[],
  bins: number,
): { labels: string[]; counts: number[] } {
  if (values.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { labels: [String(min)], counts: [values.length] };
  const binWidth = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= bins) idx = bins - 1;
    counts[idx]++;
  }
  const labels = counts.map((_, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    return `${lo.toFixed(0)}-${hi.toFixed(0)}`;
  });
  return { labels, counts };
}

interface GraphPanelProps {
  onClose?: () => void;
}

export function GraphPanel({ onClose: _onClose }: GraphPanelProps) {
  const { t } = useTranslation();
  const buffer = useHexEditorStore((s) => s.buffer);
  const selection = useHexEditorStore((s) => s.selection);
  const renderKey = useHexEditorStore((s) => s.renderKey);

  const [graphType, setGraphType] = useState<GraphType>("line");
  const [dataFormat, setDataFormat] = useState<DataFormat>("uint8");

  const raw = useMemo(
    () => getSelectedBytes(buffer, selection),
    [buffer, selection, renderKey],
  );
  const values = useMemo(
    () => (raw ? interpretData(raw, dataFormat) : []),
    [raw, dataFormat],
  );

  if (Platform.OS !== "web" || !Line || !Bar) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>{t('graphsWebOnly')}</Text>
      </View>
    );
  }

  if (!raw) {
    return (
      <View style={styles.container}>
        <View style={styles.controls}>
          <Text style={styles.sectionTitle}>{t('graph')}</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.noDataText}>
            {t('selectRangeToVisualize')}
          </Text>
        </View>
      </View>
    );
  }

  const start = Math.min(selection.start, selection.end);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "#adb5bd", maxTicksLimit: 10, font: { size: 10 } },
        grid: { color: "#333" },
      },
      y: {
        ticks: { color: "#adb5bd", font: { size: 10 } },
        grid: { color: "#333" },
      },
    },
  };

  const titleCallback = (items: { label: string; dataIndex: number }[]) => {
    if (graphType === "histogram") return items[0]?.label || "";
    const idx = items[0]?.dataIndex;
    return idx != null
      ? `Offset: 0x${(start + idx).toString(16).toUpperCase()}`
      : "";
  };

  const lineOptions: ChartOptions<"line"> = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, tooltip: { callbacks: { title: titleCallback } } },
  };

  const barOptions: ChartOptions<"bar"> = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, tooltip: { callbacks: { title: titleCallback } } },
  };

  const lineData = {
    labels: values.map((_, i) => i.toString()),
    datasets: [
      {
        data: values,
        borderColor: "#007bff",
        backgroundColor: "rgba(0,123,255,0.1)",
        borderWidth: 1.5,
        pointRadius: values.length > 200 ? 0 : 2,
        fill: true,
        tension: 0,
      },
    ],
  };

  const histogram = buildHistogram(
    values,
    Math.min(32, Math.ceil(Math.sqrt(values.length))),
  );
  const histogramData = {
    labels: histogram.labels,
    datasets: [
      {
        data: histogram.counts,
        backgroundColor: "rgba(0,123,255,0.6)",
        borderColor: "#007bff",
        borderWidth: 1,
      },
    ],
  };

  const barData = {
    labels: values.map((_, i) => i.toString()),
    datasets: [
      {
        data: values,
        backgroundColor: "rgba(0,123,255,0.6)",
        borderColor: "#007bff",
        borderWidth: 1,
      },
    ],
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.sectionTitle}>{t('graph')}</Text>
        <Text style={styles.infoText}>
          {t('valuesFromBytes', { values: values.length, bytes: raw.length })}
        </Text>
      </View>

      {/* Graph type selector */}
      <View style={styles.row}>
        <Text style={styles.label}>{t('type')}</Text>
        {([
          { key: "line" as GraphType, label: t('graphLine') },
          { key: "bar" as GraphType, label: t('graphBar') },
          { key: "histogram" as GraphType, label: t('graphHistogram') },
        ]).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.chip, graphType === item.key && styles.chipActive]}
            onPress={() => setGraphType(item.key)}
          >
            <Text
              style={[
                styles.chipText,
                graphType === item.key && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data format selector */}
      <View style={styles.row}>
        <Text style={styles.label}>{t('format')}</Text>
        {(
          ["uint8", "int8", "uint16le", "uint16be", "float32le"] as DataFormat[]
        ).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, dataFormat === f && styles.chipActive]}
            onPress={() => setDataFormat(f)}
          >
            <Text
              style={[
                styles.chipText,
                dataFormat === f && styles.chipTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {graphType === "line" && (
          <Line data={lineData} options={lineOptions} />
        )}
        {graphType === "bar" && <Bar data={barData} options={barOptions} />}
        {graphType === "histogram" && (
          <Bar data={histogramData} options={barOptions} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: "#6c757d",
    fontSize: 11,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 4,
  },
  label: {
    color: "#adb5bd",
    fontSize: 12,
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#343a40",
  },
  chipActive: {
    backgroundColor: "#007bff",
  },
  chipText: {
    color: "#adb5bd",
    fontSize: 11,
  },
  chipTextActive: {
    color: "#fff",
  },
  chartContainer: {
    height: 300,
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  noDataText: {
    color: "#6c757d",
    fontSize: 13,
    textAlign: "center",
  },
});
