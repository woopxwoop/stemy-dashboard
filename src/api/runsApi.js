/**
 * runsApi.js — single import door for the whole app.
 *
 * Expected API contract
 * ─────────────────────
 * GET /runs       → ApiRun[]  (datapoints may be omitted on list endpoint)
 * GET /runs/:id   → ApiRun    (full, with datapoints)
 *
 * ApiRun:       { id: string, name: string, groupName?: string, datapoints: ApiDatapoint[] }
 * ApiDatapoint: { day: number, value: number, time?: number }
 *
 * ── Switching between mock and real ──────────────────────────────────────────
 *
 * MOCK (default while developing):
 *   export { fetchRuns, fetchRun } from "./mockRunsApi";   ← active
 *
 * REAL endpoint:
 *   Comment out the re-export above and uncomment the two async functions below.
 */

// ── Config (only used by the real fetch functions) ────────────────────────────
export const API_BASE_URL = "https://api.example.com";

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeRunDataset(apiRun) {
  const labels = [];
  const values = [];
  const times = [];

  for (const dp of apiRun.datapoints ?? []) {
    const day = Math.max(1, Math.round(dp.day));
    labels.push(`Day ${day}`);
    values.push(Number(dp.value));
    times.push(Number.isFinite(dp.time) ? dp.time : day - 0.5);
  }

  return { labels, values, times };
}

export function groupApiRuns(apiRuns) {
  const groups = new Map();
  for (const run of apiRuns) {
    const key = run.groupName ?? "API Runs";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: run.id, name: run.name });
  }
  return Array.from(groups.entries()).map(([groupName, runs]) => ({
    groupName,
    runs,
  }));
}

// ── Active fetch implementation ───────────────────────────────────────────────
// Mock is active. To switch to the real API, comment this line out and
// uncomment the two async functions below.
export { fetchRuns, fetchRun } from "./mockRunsApi";

// ── Real fetch functions (uncomment to use) ───────────────────────────────────
//
// export async function fetchRuns() {
//   const res = await fetch(`${API_BASE_URL}/runs`);
//   if (!res.ok) throw new Error(`Failed to fetch runs (${res.status})`);
//   return res.json();
// }
//
// export async function fetchRun(runId) {
//   const res = await fetch(`${API_BASE_URL}/runs/${encodeURIComponent(runId)}`);
//   if (!res.ok) throw new Error(`Failed to fetch run "${runId}" (${res.status})`);
//   return res.json();
// }
