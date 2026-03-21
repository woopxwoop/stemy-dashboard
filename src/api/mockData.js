/**
 * mockData.js
 *
 * Realistic-looking bioreactor run data matching the ApiRun contract.
 * Two groups (Batch A, Batch B), four runs each with different profiles:
 *   - normal healthy run
 *   - run with a mid-experiment temperature spike
 *   - run with gradual drift
 *   - short aborted run
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Box-Muller normal sample */
function randn(mean = 0, sd = 1) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Generates datapoints for one run.
 *
 * @param {{ days, samplesPerDay, baseMean, baseNoise, drift, spikeDay, spikeAmount }} opts
 * @returns {ApiDatapoint[]}
 */
function generateDatapoints({
  days = 14,
  samplesPerDay = 4,
  baseMean = 37.0,
  baseNoise = 0.08,
  drift = 0, // value added to mean per day
  spikeDay = null, // day to insert an outlier cluster
  spikeAmount = 0,
  min = 36.0,
  max = 38.5,
}) {
  const points = [];
  for (let day = 1; day <= days; day++) {
    const dayMean = baseMean + drift * (day - 1);
    const isSpike = spikeDay !== null && day === spikeDay;
    for (let s = 0; s < samplesPerDay; s++) {
      const noise = isSpike && s < 2 ? spikeAmount : 0;
      const value = clamp(randn(dayMean + noise, baseNoise), min, max);
      // Evenly spread samples across the day, with slight jitter
      const time = day - 1 + (s + 0.5 + randn(0, 0.05)) / samplesPerDay;
      points.push({
        day,
        value: Math.round(value * 100) / 100,
        time: Math.round(time * 1000) / 1000,
      });
    }
  }
  return points;
}

// ── Mock runs ─────────────────────────────────────────────────────────────────

export const MOCK_RUNS = [
  // ── Batch A — temperature (°C) ────────────────────────────────────────────

  {
    id: "run-a1",
    name: "Batch A — Nominal",
    groupName: "Batch A",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 4,
      baseMean: 37.0,
      baseNoise: 0.06,
      min: 36.5,
      max: 37.8,
    }),
  },
  {
    id: "run-a2",
    name: "Batch A — Temp spike day 6",
    groupName: "Batch A",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 4,
      baseMean: 37.0,
      baseNoise: 0.07,
      spikeDay: 6,
      spikeAmount: 0.7,
      min: 36.5,
      max: 38.5,
    }),
  },
  {
    id: "run-a3",
    name: "Batch A — Gradual drift",
    groupName: "Batch A",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 4,
      baseMean: 36.8,
      baseNoise: 0.07,
      drift: 0.06,
      min: 36.5,
      max: 38.2,
    }),
  },
  {
    id: "run-a4",
    name: "Batch A — Aborted (day 5)",
    groupName: "Batch A",
    datapoints: generateDatapoints({
      days: 5,
      samplesPerDay: 4,
      baseMean: 37.0,
      baseNoise: 0.09,
      min: 36.5,
      max: 37.8,
    }),
  },

  // ── Batch B — pH (Matrigel environment) ───────────────────────────────────

  {
    id: "run-b1",
    name: "Batch B — Nominal",
    groupName: "Batch B",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 3,
      baseMean: 7.3,
      baseNoise: 0.025,
      min: 7.1,
      max: 7.55,
    }),
  },
  {
    id: "run-b2",
    name: "Batch B — pH drop day 9",
    groupName: "Batch B",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 3,
      baseMean: 7.3,
      baseNoise: 0.025,
      spikeDay: 9,
      spikeAmount: -0.22,
      min: 6.9,
      max: 7.55,
    }),
  },
  {
    id: "run-b3",
    name: "Batch B — Acidification drift",
    groupName: "Batch B",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 3,
      baseMean: 7.38,
      baseNoise: 0.025,
      drift: -0.015,
      min: 7.0,
      max: 7.55,
    }),
  },
  {
    id: "run-b4",
    name: "Batch B — High noise",
    groupName: "Batch B",
    datapoints: generateDatapoints({
      days: 14,
      samplesPerDay: 3,
      baseMean: 7.3,
      baseNoise: 0.07,
      min: 7.0,
      max: 7.6,
    }),
  },
];

/** Lookup map for O(1) fetchRun by id */
export const MOCK_RUNS_BY_ID = Object.fromEntries(
  MOCK_RUNS.map((r) => [r.id, r]),
);
