import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRun, normalizeRunDataset } from "../api/runsApi";

/**
 * Fetches and normalizes a single run's data for a chart panel.
 *
 * Usage:
 *   const { dataset, isLoading, error, refetch } = useRunApi(runId);
 *
 * - Pass `null` or `undefined` for `runId` to skip fetching (panel is in
 *   manual / file-upload / streaming mode).
 * - `dataset` has the same shape as every other dataset in the app:
 *   { labels: string[], values: number[], times: number[] }
 * - Call `refetch()` to re-request the same run (e.g. a refresh button).
 *
 * @param {string | null | undefined} runId
 * @returns {{ dataset: object|null, isLoading: boolean, error: string, refetch: () => void }}
 */
export function useRunApi(runId) {
  const [dataset, setDataset] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Tracks the runId that was last successfully fetched so we can skip
  // redundant requests when the component re-renders without a runId change.
  const fetchedForRef = useRef(null);

  const load = useCallback(async (id) => {
    if (!id) return;

    setIsLoading(true);
    setError("");

    try {
      const apiRun = await fetchRun(id);
      setDataset(normalizeRunDataset(apiRun));
      fetchedForRef.current = id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when runId first appears or changes.
  useEffect(() => {
    if (!runId || runId === fetchedForRef.current) return;
    load(runId);
  }, [runId, load]);

  const refetch = useCallback(() => {
    fetchedForRef.current = null;
    load(runId);
  }, [runId, load]);

  return { dataset, isLoading, error, refetch };
}
