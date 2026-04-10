/**
 * runsApi.js — single import door for the whole app.
 *
 * Real API: GET https://stemy-hub.fly.dev/api/export
 * Returns:  { runs: StemyRun[], run_count: number }
 *
 * StemyRun: {
 *   run_id: string,
 *   created_ts: string,        // ISO timestamp — used as "Day 1" anchor
 *   updated_ts: string,
 *   title: string | null,
 *   state: Record<string, any>,
 *   datapoints: StemyDatapoint[]
 * }
 *
 * StemyDatapoint: {
 *   run_id: string,
 *   patch_id: string,
 *   ts: string,                // ISO timestamp — position on timeline
 *   variable: string,          // e.g. "maintenance.o2_percent"
 *   label: string,
 *   value: number | null,
 *   formatted_value: string,
 *   unit: string,
 *   confidence: number,
 * }
 */

// ── Config ────────────────────────────────────────────────────────────────────
export const API_BASE_URL = "https://stemy-hub.fly.dev/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive a display name for a run — prefer title, fall back to run_id. */
function runDisplayName(run) {
  return run.title?.trim() || run.run_id;
}

/**
 * Convert a StemyRun into the internal { labels, values, times } dataset.
 *
 * Timeline strategy:
 *  - Day 1 anchor = run's created_ts.
 *  - Each datapoint's fractional day = (ts - anchor) / msPerDay + 1.
 *  - Only datapoints with a numeric value are included.
 *  - When a run has no numeric datapoints we return an empty dataset so the
 *    panel still mounts (it will show the mock fallback inside EChart).
 */
export function normalizeRunDataset(apiRun) {
  const labels = [];
  const values = [];
  const times = [];

  const anchorMs = apiRun.created_ts
    ? new Date(apiRun.created_ts).getTime()
    : null;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (const dp of apiRun.datapoints ?? []) {
    const numeric = Number(dp.value);
    if (!Number.isFinite(numeric)) continue;

    let fractionalDay = 1;
    if (anchorMs !== null && dp.ts) {
      const dpMs = new Date(dp.ts).getTime();
      fractionalDay = Math.max(0, (dpMs - anchorMs) / MS_PER_DAY) + 1;
    }

    const day = Math.max(1, Math.ceil(fractionalDay));
    labels.push(`Day ${day}`);
    values.push(numeric);
    times.push(Number(fractionalDay.toFixed(4)));
  }

  return { labels, values, times };
}

/**
 * Group a flat array of normalized runs (with .id / .name / .groupName) into
 * the { groupName, runs[] } structure the run manager expects.
 */
export function groupApiRuns(apiRuns) {
  const groups = new Map();
  for (const run of apiRuns) {
    const key = run.groupName ?? "Runs";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: run.id, name: run.name });
  }
  return Array.from(groups.entries()).map(([groupName, runs]) => ({
    groupName,
    runs,
  }));
}

// ── Fetch implementation ──────────────────────────────────────────────────────

/** Cache the export payload so fetchRun doesn't need a second network call. */
let _exportCache = null;
let _exportCacheTs = 0;
const CACHE_TTL_MS = 30_000; // 30 s

async function getExport() {
  const now = Date.now();
  if (_exportCache && now - _exportCacheTs < CACHE_TTL_MS) {
    return _exportCache;
  }
  const res = await fetch(`${API_BASE_URL}/export`);
  if (!res.ok) throw new Error(`Failed to fetch export (${res.status})`);
  _exportCache = await res.json();
  _exportCacheTs = now;
  return _exportCache;
}

/**
 * Fetches all runs from the Stemy export endpoint.
 * Returns a normalized array compatible with useRunManager / groupApiRuns.
 */
export async function fetchRuns() {
  const json = await getExport();

  return (json.runs ?? []).map((run) => ({
    id: run.run_id,
    name: runDisplayName(run),
    groupName: "Runs",
  }));
}

/**
 * Returns a single run with full datapoints.
 * Re-uses the cached export payload from fetchRuns when available.
 */
export async function fetchRun(runId) {
  const json = await getExport();
  const run = (json.runs ?? []).find((r) => r.run_id === runId);
  if (!run) throw new Error(`Run "${runId}" not found`);

  return {
    id: run.run_id,
    name: runDisplayName(run),
    created_ts: run.created_ts,
    datapoints: run.datapoints ?? [],
  };
}
