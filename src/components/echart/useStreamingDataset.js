import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChartDataStream,
  STREAM_PRESETS,
  DEFAULT_STREAM_PRESET,
} from "../../utils/simulateStream";
import {
  buildTimeline,
  parseManualNumber,
  computeOutlierPoints,
} from "./chartHelpers";

// Derives outlier scatter points from a dataset + manual fence values.
// Extracted so it can be called both on dataset change and on bounds change.
const recomputeOutliers = (dataset, manualBounds) => {
  if (!dataset) return [];

  const lowerFence = parseManualNumber(manualBounds.lower);
  const upperFence = parseManualNumber(manualBounds.upper);
  if (lowerFence === null || upperFence === null) return [];

  const timeline = buildTimeline(
    dataset.labels ?? [],
    dataset.values ?? [],
    dataset.times ?? null,
    dataset.samplesPerDay,
  );
  const xValues = timeline.lineData.map(([x]) => x);

  return computeOutlierPoints(dataset.values, xValues, lowerFence, upperFence);
};

function useStreamingDataset({ manualBounds, streamPresetKey }) {
  const [dataset, setDataset] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOutlierPoints, setStreamOutlierPoints] = useState([]);

  const streamRef = useRef(null);
  const boundsRef = useRef(manualBounds);
  const datasetRef = useRef(dataset);

  useEffect(() => {
    boundsRef.current = manualBounds;
  }, [manualBounds]);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  // Re-derive outliers whenever bounds change (dataset stays the same).
  useEffect(() => {
    setStreamOutlierPoints(recomputeOutliers(datasetRef.current, manualBounds));
  }, [manualBounds]);

  // Stop stream on unmount.
  useEffect(() => {
    return () => streamRef.current?.stop?.();
  }, []);

  const setDatasetWithOutliers = useCallback((nextDataset) => {
    setDataset(nextDataset);
    setStreamOutlierPoints(recomputeOutliers(nextDataset, boundsRef.current));
  }, []);

  const startStream = useCallback(() => {
    streamRef.current?.stop?.();
    setStreamOutlierPoints([]);

    const selectedPreset =
      STREAM_PRESETS[streamPresetKey] ?? STREAM_PRESETS[DEFAULT_STREAM_PRESET];

    streamRef.current = createChartDataStream(selectedPreset.config);

    streamRef.current.start((nextDataset) => {
      setDataset(nextDataset);
      setStreamOutlierPoints(recomputeOutliers(nextDataset, boundsRef.current));
    });

    setIsStreaming(true);
    return selectedPreset;
  }, [streamPresetKey]);

  const stopStream = useCallback(() => {
    streamRef.current?.stop?.();
    setIsStreaming(false);
  }, []);

  return {
    dataset,
    isStreaming,
    streamOutlierPoints,
    setDatasetWithOutliers,
    startStream,
    stopStream,
  };
}

export default useStreamingDataset;
