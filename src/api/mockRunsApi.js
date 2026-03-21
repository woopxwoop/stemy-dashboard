/**
 * mockRunsApi.js
 *
 * Drop-in replacement for the real fetch functions in runsApi.js.
 *
 * TO ACTIVATE — in runsApi.js, swap the bottom two exports to:
 *   export { fetchRuns, fetchRun } from "./mockRunsApi";
 *
 * TO DEACTIVATE — revert to the two real async functions.
 *
 * Data lives in mockData.js (8 runs across 2 groups, with spikes/drift/abort).
 */

import { MOCK_RUNS, MOCK_RUNS_BY_ID } from "./mockData";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Simulates GET /runs — returns run metadata without datapoints.
 * @returns {Promise<Omit<ApiRun, "datapoints">[]>}
 */
export async function fetchRuns() {
  await delay(400 + Math.random() * 200);
  return MOCK_RUNS.map(({ ...run }) => {
    delete run.datapoints;
    return run;
  });
}

/**
 * Simulates GET /runs/:id — returns one run with full datapoints.
 * @param {string} runId
 * @returns {Promise<ApiRun>}
 */
export async function fetchRun(runId) {
  await delay(200 + Math.random() * 150);
  const run = MOCK_RUNS_BY_ID[runId];
  if (!run) throw new Error(`Run "${runId}" not found`);
  return run;
}
