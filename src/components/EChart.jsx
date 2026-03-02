import React, { useMemo, useState, useRef, useEffect } from "react";
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

function EChart() {
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
  const [normalArray] = useState(generateNormalArray(25, 25, 5));

  // DOM refs.
  const chartRef = useRef(null);
  const wrapperRef = useRef(null);
  const settingsRef = useRef(null);

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
        chartRef.current?.getEchartsInstance?.().resize({ width, height });
      });
    });

    observer.observe(wrapper);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  // Build chart option object from current data + bounds state.
  const option = useMemo(() => {
    const values = dataset?.values ?? normalArray;
    const xLabels = dataset?.labels ?? DEFAULT_X_LABELS;

    const manualLower = parseManualNumber(manualBounds.lower);
    const manualUpper = parseManualNumber(manualBounds.upper);
    const useStreamingFastPath =
      isStreaming && manualLower !== null && manualUpper !== null;

    let lowerFence = manualLower ?? DEFAULT_BOUNDS.lower;
    let upperFence = manualUpper ?? DEFAULT_BOUNDS.upper;
    let median = null;
    let outlierPoints = streamOutlierPoints;

    if (useStreamingFastPath) {
      median = (lowerFence + upperFence) / 2;
      outlierPoints = streamOutlierPoints;
    } else {
      const sorted = [...values].sort((a, b) => a - b);
      const n = sorted.length;
      const q1 = sorted[Math.floor(n * 0.25)] ?? DEFAULT_BOUNDS.lower;
      const q3 = sorted[Math.floor(n * 0.75)] ?? DEFAULT_BOUNDS.upper;
      const iqr = q3 - q1;
      median =
        n % 2 === 0
          ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
          : sorted[Math.floor(n / 2)];

      lowerFence = manualLower ?? q1 - 1.5 * iqr;
      upperFence = manualUpper ?? q3 + 1.5 * iqr;
      outlierPoints = computeOutlierPoints(
        values,
        xLabels,
        lowerFence,
        upperFence,
      );
    }

    return {
      grid: {
        left: 36,
        right: 14,
        top: 16,
        bottom: 28,
        containLabel: true,
      },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: xLabels,
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
          data: values,
          markLine: {
            data: [
              ...(Number.isFinite(median)
                ? [
                    {
                      yAxis: median,
                      name: "Median",
                      label: { formatter: "Median" },
                      lineStyle: { color: "#5470c6" },
                    },
                  ]
                : []),
              {
                yAxis: upperFence,
                name: "Upper fence",
                label: { formatter: "Q3 + 1.5 IQR" },
                lineStyle: { color: "#faad14", type: "dashed" },
              },
              {
                yAxis: lowerFence,
                name: "Lower fence",
                label: { formatter: "Q1 - 1.5 IQR" },
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
          data: outlierPoints,
          symbolSize: 10,
          itemStyle: { color: "#ff4d4f" },
          z: 5,
          tooltip: {
            valueFormatter: (value) => `${value}`,
          },
        },
      ],
    };
  }, [dataset, isStreaming, manualBounds, normalArray, streamOutlierPoints]);

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
