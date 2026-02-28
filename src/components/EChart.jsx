import React, { useMemo, useState, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import generateNormalArray from "../utils/NormallyDistributedArray";
import * as XLSX from "xlsx";

// function getRandomInt(max) {
//   return Math.ceil(Math.random() * max);
// }

// function getRandomIntArray(length, maxValue) {
//   return Array.from({ length: length }, () => getRandomInt(maxValue));
// }

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => line.split(",").map((value) => value.trim()));
}

function getSeriesDataFromRows(rows) {
  if (!rows || rows.length < 2) {
    return null;
  }

  const dataRows = rows.slice(1);
  const labels = [];
  const values = [];

  for (const row of dataRows) {
    if (!row || row.length < 2) {
      continue;
    }

    const label = String(row[0] ?? "").trim();
    const numericValue = Number(String(row[1] ?? "").replace(/,/g, ""));

    if (!label || Number.isNaN(numericValue)) {
      continue;
    }

    labels.push(label);
    values.push(numericValue);
  }

  if (labels.length === 0) {
    return null;
  }

  return { labels, values };
}

function EChart() {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [manualBounds, setManualBounds] = useState({ lower: "", upper: "" });

  const [normalArray] = useState(generateNormalArray(25, 25, 5));

  const chartRef = useRef(null);
  const wrapperRef = useRef(null);

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

  const option = useMemo(() => {
    const values = dataset?.values ?? normalArray;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const median =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    const lowerFence =
      manualBounds.lower !== "" ? Number(manualBounds.lower) : q1 - 1.5 * iqr;
    const upperFence =
      manualBounds.upper !== "" ? Number(manualBounds.upper) : q3 + 1.5 * iqr;

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
        data: dataset?.labels ?? ["1h", "2h", "3h", "4h", "5h", "6h", "7h"],
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: values.map((v) => ({
            value: v,
            symbolSize: v < lowerFence || v > upperFence ? 10 : 4,
            itemStyle:
              v < lowerFence || v > upperFence
                ? { color: "#ff4d4f" }
                : { color: "#5470c6" },
          })),
          markLine: {
            data: [
              {
                yAxis: median,
                name: "Median",
                label: { formatter: "Median" },
                lineStyle: { color: "#5470c6" },
              },
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
      ],
    };
  }, [dataset, manualBounds, normalArray]);

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSelectedFileName(file.name);

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

      setDataset(nextDataset);
    } catch (readError) {
      setError(
        readError instanceof Error ? readError.message : "Failed to parse file",
      );
    }
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <div className="toolbar chart-toolbar">
        <div className="toolbar-group toolbar-group--file">
          <input
            className="control-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            onChange={onFileChange}
          />
          <span className="file-name">
            {selectedFileName || "No file loaded"}
          </span>
        </div>

        <div className="toolbar-group toolbar-group--bounds">
          <label className="toolbar-label">
            Lower bound:
            <input
              className="control-input"
              type="number"
              value={manualBounds.lower}
              placeholder="Auto (IQR)"
              onChange={(e) =>
                setManualBounds((prev) => ({ ...prev, lower: e.target.value }))
              }
            />
          </label>

          <label className="toolbar-label">
            Upper bound:
            <input
              className="control-input"
              type="number"
              value={manualBounds.upper}
              placeholder="Auto (IQR)"
              onChange={(e) =>
                setManualBounds((prev) => ({ ...prev, upper: e.target.value }))
              }
            />
          </label>

          <button
            className="control-button"
            onClick={() => setManualBounds({ lower: "", upper: "" })}
          >
            Reset to IQR
          </button>
        </div>

        {error && <span className="control-error">{error}</span>}
      </div>

      <div
        ref={wrapperRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      >
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge={true}
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
