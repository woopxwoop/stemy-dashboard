import {
  STREAM_PRESETS,
  DEFAULT_STREAM_PRESET,
} from "../../utils/simulateStream";

export const DEFAULT_BOUNDS = {
  lower: 24,
  upper: 26,
};

export const DEFAULT_X_LABELS = [
  "1h",
  "2h",
  "3h",
  "4h",
  "5h",
  "6h",
  "7h",
  "8h",
  "9h",
  "10h",
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

// Keep manual bound inputs nullable so "empty" can still mean auto mode.
export const parseManualNumber = (value) => {
  const text = `${value ?? ""}`.trim();
  if (text === "") return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

// Build [x, y] tuples for scatter outlier rendering.
export const computeOutlierPoints = (values, labels, lowerFence, upperFence) =>
  values
    .map((value, index) =>
      value < lowerFence || value > upperFence ? [labels[index], value] : null,
    )
    .filter(Boolean);
