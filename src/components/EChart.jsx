import React, { useMemo, useState, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import generateNormalArray from "../utils/NormallyDistributedArray";
import { DEFAULT_STREAM_PRESET } from "../utils/simulateStream";
import {
  DEFAULT_BOUNDS,
  DEFAULT_X_LABELS,
  buildTimeline,
  getBoundsFromPreset,
  parseManualNumber,
  computeOutlierPoints,
} from "./echart/chartHelpers";
import ChartSettingsPopover from "./echart/ChartSettingsPopover";
import useStreamingDataset from "./echart/useStreamingDataset";
import { useDayHoverSync } from "../hooks/useDayHoverSync";
import { useChartResize } from "../hooks/useChartResize";
import { useFileImport } from "../hooks/useFileImport";

// ── Static fallback dataset (no file loaded, no stream active) ───────────────

function buildMockDataset() {
  const labels = [];
  const times = [];

  DEFAULT_X_LABELS.forEach((_, index) => {
    const day = index + 1;
    const samplesForDay = 1 + Math.floor(Math.random() * 3);

    for (let s = 0; s < samplesForDay; s++) {
      labels.push(`Day ${day}`);
      times.push(day - 1 + (s + 0.5) / samplesForDay);
    }
  });

  return { labels, times, values: generateNormalArray(labels.length, 37, 0.3) };
}

// ── EChart panel ─────────────────────────────────────────────────────────────

function EChart(props) {
  const linkScope = props?.params?.linkScope ?? "global";

  // Core state.
  const initialBounds = getBoundsFromPreset(DEFAULT_STREAM_PRESET);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [streamPresetKey, setStreamPresetKey] = useState(DEFAULT_STREAM_PRESET);
  const [manualBounds, setManualBounds] = useState(initialBounds);

  const {
    dataset,
    isStreaming,
    streamOutlierPoints,
    setDatasetWithOutliers,
    startStream,
    stopStream,
  } = useStreamingDataset({ manualBounds, streamPresetKey });

  // Stable mock data — recreated only on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mockDataset = useMemo(() => buildMockDataset(), []);

  // DOM / instance refs.
  const wrapperRef = useRef(null);
  const settingsRef = useRef(null);
  const dayToDataIndicesRef = useRef(new Map());
  const [chartInstance, setChartInstance] = useState(null);
  const onChartReady = useCallback(
    (instance) => setChartInstance(instance),
    [],
  );

  // ── Linked hover sync (cross-panel) ─────────────────────────────────────
  useDayHoverSync({ chartInstance, linkScope, dayToDataIndicesRef });

  // ── Resize observer ───────────────────────────────────────────────────────
  const chartSize = useChartResize(wrapperRef, chartInstance);

  // ── Settings popover close-on-outside-click / Escape ─────────────────────
  React.useEffect(() => {
    if (!isSettingsOpen) return;

    const onPointerDown = (e) => {
      if (!settingsRef.current?.contains(e.target)) setIsSettingsOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsSettingsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsOpen]);

  // ── File import ───────────────────────────────────────────────────────────
  const { handleFileChange } = useFileImport({
    onDataset: setDatasetWithOutliers,
    onError: setError,
    onFileName: setSelectedFileName,
    onStreamStop: stopStream,
  });

  // ── Stream controls ───────────────────────────────────────────────────────
  const handleStartStream = useCallback(() => {
    const preset = startStream();
    setError("");
    setSelectedFileName(`Simulated ${preset.label} stream`);
  }, [startStream]);

  const onStreamPresetChange = useCallback((nextKey) => {
    setStreamPresetKey(nextKey);
    setManualBounds(getBoundsFromPreset(nextKey));
  }, []);

  // ── Chart option ──────────────────────────────────────────────────────────
  const option = useMemo(() => {
    const activeDataset = dataset ?? mockDataset;
    const timeline = buildTimeline(
      activeDataset.labels,
      activeDataset.values,
      activeDataset.times,
      activeDataset.samplesPerDay ?? 8,
    );

    dayToDataIndicesRef.current = timeline.dayToDataIndices;

    const manualLower = parseManualNumber(manualBounds.lower);
    const manualUpper = parseManualNumber(manualBounds.upper);

    let lowerFence, upperFence, outlierPoints;

    if (isStreaming && manualLower !== null && manualUpper !== null) {
      // Fast path: streaming with explicit bounds — skip IQR calculation.
      lowerFence = manualLower;
      upperFence = manualUpper;
      outlierPoints = streamOutlierPoints;
    } else {
      const sorted = [...activeDataset.values].sort((a, b) => a - b);
      const q1 =
        sorted[Math.floor(sorted.length * 0.25)] ?? DEFAULT_BOUNDS.lower;
      const q3 =
        sorted[Math.floor(sorted.length * 0.75)] ?? DEFAULT_BOUNDS.upper;
      const iqr = q3 - q1;

      lowerFence = manualLower ?? q1 - 1.5 * iqr;
      upperFence = manualUpper ?? q3 + 1.5 * iqr;
      outlierPoints = computeOutlierPoints(
        activeDataset.values,
        timeline.lineData.map(([x]) => x),
        lowerFence,
        upperFence,
      );
    }

    const dayLabelStep = Math.max(1, Math.ceil(timeline.maxDay / 8));

    return {
      grid: { left: 36, right: 14, top: 16, bottom: 28, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const hoveredDay = Math.max(
            1,
            Math.floor(Number(params?.[0]?.axisValue)) + 1,
          );
          const dayValues = timeline.dayToValues.get(hoveredDay) ?? [];

          if (dayValues.length === 0) return `Day ${hoveredDay}<br/>No samples`;

          const min = Math.min(...dayValues);
          const max = Math.max(...dayValues);
          const avg = dayValues.reduce((s, v) => s + v, 0) / dayValues.length;

          return [
            `<strong>Day ${hoveredDay}</strong>`,
            `Samples: ${dayValues.length}`,
            `Min/Max: ${min.toFixed(2)} / ${max.toFixed(2)}`,
            `Avg: ${avg.toFixed(2)}`,
            `Values: ${dayValues.map((v) => v.toFixed(2)).join(", ")}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.max(0.999, timeline.maxDay - 0.000001),
        splitNumber: 8,
        minInterval: 1,
        axisLabel: {
          hideOverlap: true,
          formatter: (value) => {
            if (!Number.isFinite(value)) return "";
            if (Math.abs(value - Math.round(value)) >= 0.001) return "";
            const day = Math.round(value) + 1;
            if ((day - 1) % dayLabelStep !== 0 && day !== timeline.maxDay)
              return "";
            return `Day ${day}`;
          },
        },
      },
      yAxis: { type: "value", scale: true, boundaryGap: ["8%", "8%"] },
      series: [
        {
          type: "line",
          smooth: true,
          showSymbol: false,
          data: timeline.lineData,
          markLine: {
            data: [
              {
                yAxis: upperFence,
                name: "Upper fence",
                label: { formatter: "Upper" },
                lineStyle: { color: "#faad14", type: "dashed" },
              },
              {
                yAxis: lowerFence,
                name: "Lower fence",
                label: { formatter: "Lower" },
                lineStyle: { color: "#faad14", type: "dashed" },
              },
            ],
          },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(82, 196, 26, 0.05)" },
            data: [[{ yAxis: lowerFence }, { yAxis: upperFence }]],
          },
        },
        {
          type: "scatter",
          name: "Samples",
          data: timeline.lineData,
          symbolSize: 5,
          itemStyle: { color: "#5470c6", opacity: 0.75 },
          z: 4,
          tooltip: {
            trigger: "item",
            formatter: (param) => {
              const x = Number(param?.value?.[0]);
              const y = Number(param?.value?.[1]);
              const day = Number.isFinite(x)
                ? Math.max(1, Math.floor(x) + 1)
                : 1;
              return [
                `<strong>Sample point</strong>`,
                `Day: ${day}`,
                `Time: ${Number.isFinite(x) ? x.toFixed(3) : "-"}`,
                `Value: ${Number.isFinite(y) ? y.toFixed(2) : "-"}`,
              ].join("<br/>");
            },
          },
        },
        {
          type: "scatter",
          name: "Outliers",
          data: outlierPoints,
          symbolSize: 10,
          itemStyle: { color: "#ff4d4f" },
          z: 5,
          tooltip: {
            trigger: "item",
            formatter: (param) => {
              const x = Number(param?.value?.[0]);
              const y = Number(param?.value?.[1]);
              const day = Number.isFinite(x)
                ? Math.max(1, Math.floor(x) + 1)
                : 1;
              return [
                `<strong>Outlier point</strong>`,
                `Day: ${day}`,
                `Time: ${Number.isFinite(x) ? x.toFixed(3) : "-"}`,
                `Value: ${Number.isFinite(y) ? y.toFixed(2) : "-"}`,
              ].join("<br/>");
            },
          },
        },
      ],
    };
  }, [dataset, isStreaming, manualBounds, mockDataset, streamOutlierPoints]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="chart-panel-shell">
      <div className="chart-panel-topbar">
        <button
          className="control-button chart-settings-trigger"
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          aria-label="Toggle panel settings"
          aria-expanded={isSettingsOpen}
        >
          ⚙
        </button>
        <span className="file-name chart-panel-file-name">
          {selectedFileName || "No file loaded"}
        </span>
      </div>

      {isSettingsOpen && (
        <ChartSettingsPopover
          settingsRef={settingsRef}
          selectedFileName={selectedFileName}
          onClose={() => setIsSettingsOpen(false)}
          onFileChange={handleFileChange}
          manualBounds={manualBounds}
          onManualBoundsChange={setManualBounds}
          onResetBounds={() =>
            setManualBounds(getBoundsFromPreset(streamPresetKey))
          }
          streamPresetKey={streamPresetKey}
          onPresetChange={onStreamPresetChange}
          isStreaming={isStreaming}
          onStartStream={handleStartStream}
          onStopStream={stopStream}
        />
      )}

      {error && (
        <span className="control-error chart-panel-error">{error}</span>
      )}

      <div
        className="chart-panel-chart"
        ref={wrapperRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      >
        <ReactECharts
          onChartReady={onChartReady}
          option={option}
          lazyUpdate={true}
          style={{
            width: chartSize.width || "100%",
            height: chartSize.height || "100%",
          }}
        />
      </div>
    </div>
  );
}

export default EChart;
