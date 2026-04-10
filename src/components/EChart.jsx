import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import ReactECharts from "echarts-for-react";
import generateNormalArray from "../utils/NormallyDistributedArray";
import { DEFAULT_STREAM_PRESET, STREAM_PRESETS } from "../utils/simulateStream";
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
import { useRunApi } from "../hooks/useRunApi";

const toDisplayName = (filename) =>
  filename.replace(/\.[^.]+$/, "").replace(/^.*[\\/]/, "");

// ── Derive a sensible Y-axis label from the active data source ───────────────

function deriveYAxisLabel({
  runId,
  streamPresetKey,
  selectedFileName,
  isStreaming,
}) {
  // Streaming preset has a label built-in
  if (isStreaming) {
    const preset = STREAM_PRESETS[streamPresetKey];
    return preset?.label ?? "Value";
  }
  // File upload — use the filename stem
  if (selectedFileName) return toDisplayName(selectedFileName);
  // API run — generic until we have richer metadata
  if (runId) return "Value";
  // Mock fallback
  return "Value (°C)";
}

// ── Static fallback dataset ──────────────────────────────────────────────────

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
  const panelApi = props?.api;
  const linkScope = props?.params?.linkScope ?? "global";
  const runId = props?.params?.runId ?? null;

  const initialBounds = getBoundsFromPreset(DEFAULT_STREAM_PRESET);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [streamPresetKey, setStreamPresetKey] = useState(DEFAULT_STREAM_PRESET);
  const [manualBounds, setManualBounds] = useState(initialBounds);

  const {
    dataset: streamDataset,
    isStreaming,
    streamOutlierPoints,
    setDatasetWithOutliers,
    startStream,
    stopStream,
  } = useStreamingDataset({ manualBounds, streamPresetKey });

  const {
    dataset: apiDataset,
    isLoading: apiLoading,
    error: apiError,
    refetch: refetchRun,
  } = useRunApi(runId);

  useEffect(() => {
    if (apiError) setError(apiError);
  }, [apiError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mockDataset = useMemo(() => buildMockDataset(), []);

  const dataset = streamDataset ?? apiDataset ?? mockDataset;

  const wrapperRef = useRef(null);
  const settingsRef = useRef(null);
  const dayToDataIndicesRef = useRef(new Map());
  const [chartInstance, setChartInstance] = useState(null);
  const onChartReady = useCallback(
    (instance) => setChartInstance(instance),
    [],
  );

  useDayHoverSync({ chartInstance, linkScope, dayToDataIndicesRef });
  const chartSize = useChartResize(wrapperRef, chartInstance);

  useEffect(() => {
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

  const { handleFileChange } = useFileImport({
    onDataset: setDatasetWithOutliers,
    onError: setError,
    onFileName: (name) => {
      setSelectedFileName(name);
      panelApi?.setTitle(toDisplayName(name));
    },
    onStreamStop: stopStream,
  });

  const handleStartStream = useCallback(() => {
    const preset = startStream();
    setError("");
    setSelectedFileName(preset.label);
    panelApi?.setTitle(preset.label);
  }, [startStream, panelApi]);

  const onStreamPresetChange = useCallback((nextKey) => {
    setStreamPresetKey(nextKey);
    setManualBounds(getBoundsFromPreset(nextKey));
  }, []);

  // ── Derive axis labels ────────────────────────────────────────────────────
  const yAxisLabel = deriveYAxisLabel({
    runId,
    streamPresetKey,
    selectedFileName,
    isStreaming,
  });

  // ── Chart option ──────────────────────────────────────────────────────────
  const option = useMemo(() => {
    const timeline = buildTimeline(
      dataset.labels,
      dataset.values,
      dataset.times,
      dataset.samplesPerDay ?? 8,
    );

    dayToDataIndicesRef.current = timeline.dayToDataIndices;

    const manualLower = parseManualNumber(manualBounds.lower);
    const manualUpper = parseManualNumber(manualBounds.upper);
    let lowerFence, upperFence, outlierPoints;

    if (isStreaming && manualLower !== null && manualUpper !== null) {
      lowerFence = manualLower;
      upperFence = manualUpper;
      outlierPoints = streamOutlierPoints;
    } else {
      const sorted = [...dataset.values].sort((a, b) => a - b);
      const q1 =
        sorted[Math.floor(sorted.length * 0.25)] ?? DEFAULT_BOUNDS.lower;
      const q3 =
        sorted[Math.floor(sorted.length * 0.75)] ?? DEFAULT_BOUNDS.upper;
      const iqr = q3 - q1;
      lowerFence = manualLower ?? q1 - 1.5 * iqr;
      upperFence = manualUpper ?? q3 + 1.5 * iqr;
      outlierPoints = computeOutlierPoints(
        dataset.values,
        timeline.lineData.map(([x]) => x),
        lowerFence,
        upperFence,
      );
    }

    const dayLabelStep = Math.max(1, Math.ceil(timeline.maxDay / 8));

    return {
      grid: { left: 56, right: 20, top: 24, bottom: 44, containLabel: true },
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
        name: "Time",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "#7a8fad",
          fontWeight: 500,
        },
        axisLabel: {
          hideOverlap: true,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "#7a8fad",
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
      yAxis: {
        type: "value",
        scale: true,
        boundaryGap: ["8%", "8%"],
        name: yAxisLabel,
        nameLocation: "middle",
        nameGap: 48,
        nameTextStyle: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "#7a8fad",
          fontWeight: 500,
        },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "#7a8fad",
        },
      },
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
                label: {
                  formatter: "Upper",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                },
                lineStyle: { color: "#faad14", type: "dashed" },
              },
              {
                yAxis: lowerFence,
                name: "Lower fence",
                label: {
                  formatter: "Lower",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                },
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
  }, [dataset, isStreaming, manualBounds, streamOutlierPoints, yAxisLabel]);

  const showLoadingOverlay = apiLoading && !streamDataset;

  return (
    <div className="chart-panel-shell">
      <div className="chart-panel-topbar">
        <button
          className="chart-settings-trigger"
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          aria-label="Toggle panel settings"
          aria-expanded={isSettingsOpen}
        >
          ⚙
        </button>
        <span className="chart-panel-file-name">
          {apiLoading
            ? "Loading…"
            : selectedFileName || (runId ? `Run ${runId}` : "No file loaded")}
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
          runId={runId}
          apiLoading={apiLoading}
          onRefetchRun={refetchRun}
        />
      )}

      {error && (
        <span className="control-error chart-panel-error">{error}</span>
      )}

      {showLoadingOverlay && (
        <div className="chart-loading-overlay">
          <span className="chart-loading-text">Loading run data…</span>
        </div>
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
