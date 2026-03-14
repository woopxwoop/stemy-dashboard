import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import ReactECharts from "echarts-for-react";
import { parseCsv, getSeriesDataFromRows } from "../utils/csvUtils";
import generateNormalArray from "../utils/NormallyDistributedArray";
import * as XLSX from "xlsx";
import { DEFAULT_STREAM_PRESET } from "../utils/simulateStream";
import {
  DEFAULT_BOUNDS,
  DEFAULT_X_LABELS,
  getBoundsFromPreset,
  parseManualNumber,
  computeOutlierPoints,
} from "./echart/chartHelpers";
import ChartSettingsPopover from "./echart/ChartSettingsPopover";
import useStreamingDataset from "./echart/useStreamingDataset";

const DAY_HOVER_EVENT = "atheria:day-hover";

const buildTimeline = (
  labels,
  values,
  timeValues = null,
  fallbackSamplesPerDay = 8,
) => {
  const dayByIndex = labels.map((label, index) => {
    const match = String(label ?? "").match(/(\d+)/);
    if (match) return Math.max(1, Number(match[1]));
    return Math.max(
      1,
      Math.ceil((index + 1) / Math.max(1, fallbackSamplesPerDay)),
    );
  });

  const dayCounts = new Map();
  dayByIndex.forEach((day) => {
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  });

  const daySeen = new Map();
  const dayToDataIndices = new Map();
  const dayToValues = new Map();

  const lineData = [];

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;

    const day = dayByIndex[index];
    const seen = (daySeen.get(day) ?? 0) + 1;
    daySeen.set(day, seen);

    const count = Math.max(1, dayCounts.get(day) ?? 1);
    const generatedX = day - 1 + (seen - 0.5) / count;
    const x =
      Array.isArray(timeValues) && Number.isFinite(timeValues[index])
        ? timeValues[index]
        : generatedX;

    const lineDataIndex = lineData.length;
    lineData.push([x, value]);

    if (!dayToDataIndices.has(day)) dayToDataIndices.set(day, []);
    dayToDataIndices.get(day).push(lineDataIndex);

    if (!dayToValues.has(day)) dayToValues.set(day, []);
    dayToValues.get(day).push(value);
  });

  const maxDay = Math.max(1, ...dayByIndex);

  return {
    lineData,
    dayByIndex,
    dayToDataIndices,
    dayToValues,
    maxDay,
  };
};

function EChart(props) {
  // Core panel state.
  const initialBounds = getBoundsFromPreset(DEFAULT_STREAM_PRESET);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
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

  // Fallback local series when no dataset is loaded.
  const mockDataset = useMemo(() => {
    const labels = [];
    const times = [];

    DEFAULT_X_LABELS.forEach((_, index) => {
      const day = index + 1;
      const samplesForDay = 1 + Math.floor(Math.random() * 3);

      for (let sampleIndex = 0; sampleIndex < samplesForDay; sampleIndex += 1) {
        labels.push(`Day ${day}`);
        times.push(day - 1 + (sampleIndex + 0.5) / samplesForDay);
      }
    });

    const values = generateNormalArray(labels.length, 37, 0.3);

    return {
      labels,
      values,
      times,
    };
  }, []);

  // DOM refs.
  const chartRef = useRef(null);
  const wrapperRef = useRef(null);
  const settingsRef = useRef(null);
  const chartIdRef = useRef(`chart_${Math.random().toString(36).slice(2)}`);
  const linkScopeRef = useRef(props?.params?.linkScope ?? "global");
  const dayToDataIndicesRef = useRef(new Map());
  const suppressBroadcastRef = useRef(false);
  const [chartInstance, setChartInstance] = useState(null);

  const onChartReady = useCallback((instance) => {
    setChartInstance(instance);
  }, []);

  useEffect(() => {
    if (!chartInstance) return;

    const onAxisPointerUpdate = (event) => {
      if (suppressBroadcastRef.current) return;

      const axisValue = event?.axesInfo?.[0]?.value;
      if (!Number.isFinite(axisValue)) return;

      const day = Math.max(1, Math.floor(axisValue) + 1);
      window.dispatchEvent(
        new CustomEvent(DAY_HOVER_EVENT, {
          detail: {
            source: chartIdRef.current,
            day,
            scope: linkScopeRef.current,
          },
        }),
      );
    };

    const onGlobalOut = () => {
      window.dispatchEvent(
        new CustomEvent(DAY_HOVER_EVENT, {
          detail: {
            source: chartIdRef.current,
            day: null,
            scope: linkScopeRef.current,
          },
        }),
      );
    };

    const onDayHover = (event) => {
      const { source, day, scope } = event.detail ?? {};
      if (source === chartIdRef.current) return;
      if (scope !== linkScopeRef.current) return;

      if (!Number.isFinite(day)) {
        suppressBroadcastRef.current = true;
        chartInstance.dispatchAction({ type: "hideTip" });
        setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 0);
        return;
      }

      const dataIndices = dayToDataIndicesRef.current.get(day) ?? [];
      const dataIndex = dataIndices[0];

      if (!Number.isInteger(dataIndex)) {
        suppressBroadcastRef.current = true;
        chartInstance.dispatchAction({ type: "hideTip" });
        setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 0);
        return;
      }

      suppressBroadcastRef.current = true;
      chartInstance.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex,
      });
      setTimeout(() => {
        suppressBroadcastRef.current = false;
      }, 0);
    };

    chartInstance.on("updateAxisPointer", onAxisPointerUpdate);
    chartInstance.on("globalout", onGlobalOut);
    window.addEventListener(DAY_HOVER_EVENT, onDayHover);

    return () => {
      chartInstance.off("updateAxisPointer", onAxisPointerUpdate);
      chartInstance.off("globalout", onGlobalOut);
      window.removeEventListener(DAY_HOVER_EVENT, onDayHover);
    };
  }, [chartInstance]);

  // Close settings popup on outside click / Escape key.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!isSettingsOpen) return;
      if (settingsRef.current?.contains(event.target)) return;
      setIsSettingsOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsOpen]);

  // Start stream via hook and update panel metadata.
  const handleStartStream = () => {
    const selectedPreset = startStream();
    setError("");
    setSelectedFileName(`Simulated ${selectedPreset.label} stream`);
  };

  // Selecting a preset also applies its expected UI bounds.
  const onStreamPresetChange = (nextPresetKey) => {
    setStreamPresetKey(nextPresetKey);
    setManualBounds(getBoundsFromPreset(nextPresetKey));
  };

  // Keep chart canvas synced with panel resize.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let frameId = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        setChartSize({ width, height });
        // Also tell ECharts instance directly
        chartInstance?.resize({ width, height });
      });
    });

    observer.observe(wrapper);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [chartInstance]);

  // Build chart option object from current data + bounds state.
  const option = useMemo(() => {
    const values = dataset?.values ?? mockDataset.values;
    const xLabels = dataset?.labels ?? mockDataset.labels;
    const timeline = buildTimeline(
      xLabels,
      values,
      dataset?.times ?? mockDataset.times,
      dataset?.samplesPerDay ?? 8,
    );
    const dayValueMap = timeline.dayToValues;
    dayToDataIndicesRef.current = timeline.dayToDataIndices;

    const manualLower = parseManualNumber(manualBounds.lower);
    const manualUpper = parseManualNumber(manualBounds.upper);
    const useStreamingFastPath =
      isStreaming && manualLower !== null && manualUpper !== null;

    let lowerFence = manualLower ?? DEFAULT_BOUNDS.lower;
    let upperFence = manualUpper ?? DEFAULT_BOUNDS.upper;
    let outlierPoints = streamOutlierPoints;

    if (useStreamingFastPath) {
      outlierPoints = streamOutlierPoints;
    } else {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 =
        sorted[Math.floor(sorted.length * 0.25)] ?? DEFAULT_BOUNDS.lower;
      const q3 =
        sorted[Math.floor(sorted.length * 0.75)] ?? DEFAULT_BOUNDS.upper;
      const iqr = q3 - q1;

      lowerFence = manualLower ?? q1 - 1.5 * iqr;
      upperFence = manualUpper ?? q3 + 1.5 * iqr;
      outlierPoints = computeOutlierPoints(
        values,
        timeline.lineData.map(([x]) => x),
        lowerFence,
        upperFence,
      );
    }

    const dayLabelStep = Math.max(1, Math.ceil(timeline.maxDay / 8));

    return {
      grid: {
        left: 36,
        right: 14,
        top: 16,
        bottom: 28,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const hoveredX = Number(params?.[0]?.axisValue);
          const hoveredDay = Number.isFinite(hoveredX)
            ? Math.max(1, Math.floor(hoveredX) + 1)
            : 1;
          const dayValues = dayValueMap.get(hoveredDay) ?? [];

          if (dayValues.length === 0) {
            return `Day ${hoveredDay}<br/>No samples`;
          }

          const min = Math.min(...dayValues);
          const max = Math.max(...dayValues);
          const total = dayValues.reduce((sum, value) => sum + value, 0);
          const avg = total / dayValues.length;
          const formattedValues = dayValues
            .map((value) => value.toFixed(2))
            .join(", ");

          return [
            `<strong>Day ${hoveredDay}</strong>`,
            `Samples: ${dayValues.length}`,
            `Min/Max: ${min.toFixed(2)} / ${max.toFixed(2)}`,
            `Avg: ${avg.toFixed(2)}`,
            `Values: ${formattedValues}`,
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
            const isBoundary = Math.abs(value - Math.round(value)) < 0.001;
            if (!isBoundary) return "";

            const day = Math.round(value) + 1;
            if ((day - 1) % dayLabelStep !== 0 && day !== timeline.maxDay) {
              return "";
            }

            return `Day ${day}`;
          },
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        boundaryGap: ["8%", "8%"],
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

  // Handle file import (CSV/XLSX) and update chart dataset.
  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSelectedFileName(file.name);
    stopStream();

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      if (extension === "csv") {
        const text = await file.text();
        rows = parseCsv(text);
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Workbook has no sheets");
        }
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      } else {
        throw new Error("Unsupported file type. Use CSV or XLSX.");
      }

      const nextDataset = getSeriesDataFromRows(rows);
      if (!nextDataset) {
        throw new Error(
          "Could not parse chart data. Use 2 columns: label,value.",
        );
      }

      setDatasetWithOutliers(nextDataset);
    } catch (readError) {
      setError(
        readError instanceof Error ? readError.message : "Failed to parse file",
      );
    }
  };

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
          onFileChange={onFileChange}
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
          ref={chartRef}
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
