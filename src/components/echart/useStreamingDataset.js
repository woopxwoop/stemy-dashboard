import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChartDataStream,
  STREAM_PRESETS,
  DEFAULT_STREAM_PRESET,
} from "../../utils/simulateStream";
import { parseManualNumber, computeOutlierPoints } from "./chartHelpers";

const buildTimelineXValues = (dataset) => {
  if (!dataset) return [];

  const labels = Array.isArray(dataset.labels) ? dataset.labels : [];
  const timeValues = Array.isArray(dataset.times) ? dataset.times : null;
  const fallbackSamplesPerDay = Math.max(1, Number(dataset.samplesPerDay) || 8);

  const dayByIndex = labels.map((label, index) => {
    const match = String(label ?? "").match(/(\d+)/);
    if (match) return Math.max(1, Number(match[1]));
    return Math.max(1, Math.ceil((index + 1) / fallbackSamplesPerDay));
  });

  const dayCounts = new Map();
  dayByIndex.forEach((day) => {
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  });

  const daySeen = new Map();

  return dayByIndex.map((day, index) => {
    if (timeValues && Number.isFinite(timeValues[index])) {
      return timeValues[index];
    }

    const seen = (daySeen.get(day) ?? 0) + 1;
    daySeen.set(day, seen);
    const count = Math.max(1, dayCounts.get(day) ?? 1);
    return day - 1 + (seen - 0.5) / count;
  });
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

  const applyOutlierRecompute = useCallback(
    (nextDataset, bounds = manualBounds) => {
      if (!nextDataset) {
        setStreamOutlierPoints([]);
        return;
      }

      const lowerFence = parseManualNumber(bounds.lower);
      const upperFence = parseManualNumber(bounds.upper);

      if (lowerFence === null || upperFence === null) {
        setStreamOutlierPoints([]);
        return;
      }

      const xValues = buildTimelineXValues(nextDataset);

      setStreamOutlierPoints(
        computeOutlierPoints(
          nextDataset.values,
          xValues,
          lowerFence,
          upperFence,
        ),
      );
    },
    [manualBounds],
  );

  useEffect(() => {
    applyOutlierRecompute(datasetRef.current, manualBounds);
  }, [applyOutlierRecompute, manualBounds]);

  useEffect(() => {
    return () => {
      streamRef.current?.stop?.();
    };
  }, []);

  const setDatasetWithOutliers = useCallback(
    (nextDataset) => {
      setDataset(nextDataset);
      applyOutlierRecompute(nextDataset, boundsRef.current);
    },
    [applyOutlierRecompute],
  );

  const startStream = useCallback(() => {
    streamRef.current?.stop?.();
    setStreamOutlierPoints([]);

    const selectedPreset =
      STREAM_PRESETS[streamPresetKey] ?? STREAM_PRESETS[DEFAULT_STREAM_PRESET];

    streamRef.current = createChartDataStream(selectedPreset.config);

    streamRef.current.start((nextDataset) => {
      setDataset(nextDataset);

      const lowerFence = parseManualNumber(boundsRef.current.lower);
      const upperFence = parseManualNumber(boundsRef.current.upper);

      if (lowerFence === null || upperFence === null) {
        setStreamOutlierPoints([]);
        return;
      }

      const xValues = buildTimelineXValues(nextDataset);

      setStreamOutlierPoints(
        computeOutlierPoints(
          nextDataset.values,
          xValues,
          lowerFence,
          upperFence,
        ),
      );
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
