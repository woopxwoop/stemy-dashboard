import {
  STREAM_PRESETS,
  DEFAULT_STREAM_PRESET,
} from "../../utils/simulateStream";

export const DEFAULT_BOUNDS = {
  lower: 24,
  upper: 26,
};

export const DEFAULT_X_LABELS = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Day 6",
  "Day 7",
  "Day 8",
  "Day 9",
  "Day 10",
];

// Resolve UI bounds from preset "expected" thresholds first, then hard limits.
export const getBoundsFromPreset = (presetKey) => {
  const preset =
    STREAM_PRESETS[presetKey] ?? STREAM_PRESETS[DEFAULT_STREAM_PRESET];

  const lower = Number.isFinite(preset?.config?.expectedLower)
    ? preset.config.expectedLower
    : Number.isFinite(preset?.config?.min)
      ? preset.config.min
      : DEFAULT_BOUNDS.lower;

  const upper = Number.isFinite(preset?.config?.expectedUpper)
    ? preset.config.expectedUpper
    : Number.isFinite(preset?.config?.max)
      ? preset.config.max
      : DEFAULT_BOUNDS.upper;

  return {
    lower: String(lower),
    upper: String(upper),
  };
};

// Keep manual bound inputs nullable so "empty" still means auto mode.
export const parseManualNumber = (value) => {
  const text = `${value ?? ""}`.trim();
  if (text === "") return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

// Build [x, y] tuples for scatter outlier rendering.
export const computeOutlierPoints = (values, xValues, lowerFence, upperFence) =>
  values
    .map((value, index) =>
      value < lowerFence || value > upperFence ? [xValues[index], value] : null,
    )
    .filter(Boolean);

/**
 * Converts parallel label/value/time arrays into the data structures ECharts needs.
 *
 * Previously duplicated between EChart.jsx (buildTimeline) and
 * useStreamingDataset.js (buildTimelineXValues). Single source of truth.
 *
 * @returns {{
 *   lineData: [number, number][],
 *   dayByIndex: number[],
 *   dayToDataIndices: Map<number, number[]>,
 *   dayToValues: Map<number, number[]>,
 *   maxDay: number,
 * }}
 */
export const buildTimeline = (
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

  return { lineData, dayByIndex, dayToDataIndices, dayToValues, maxDay };
};
