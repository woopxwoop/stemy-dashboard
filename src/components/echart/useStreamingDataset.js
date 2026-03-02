import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChartDataStream,
  STREAM_PRESETS,
  DEFAULT_STREAM_PRESET,
} from "../../utils/simulateStream";
import { parseManualNumber, computeOutlierPoints } from "./chartHelpers";

function useStreamingDataset({ manualBounds, streamPresetKey }) {
  const [dataset, setDataset] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOutlierPoints, setStreamOutlierPoints] = useState([]);

  const streamRef = useRef(null);
  const previousStreamLabelsRef = useRef([]);
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

      setStreamOutlierPoints(
        computeOutlierPoints(
          nextDataset.values,
          nextDataset.labels,
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
    previousStreamLabelsRef.current = [];
    setStreamOutlierPoints([]);

    const selectedPreset =
      STREAM_PRESETS[streamPresetKey] ?? STREAM_PRESETS[DEFAULT_STREAM_PRESET];

    streamRef.current = createChartDataStream(selectedPreset.config);

    streamRef.current.start((nextDataset) => {
      setDataset(nextDataset);

      const lowerFence = parseManualNumber(boundsRef.current.lower);
      const upperFence = parseManualNumber(boundsRef.current.upper);

      if (lowerFence === null || upperFence === null) {
        previousStreamLabelsRef.current = nextDataset.labels;
        setStreamOutlierPoints([]);
        return;
      }

      const nextLabels = nextDataset.labels;
      const nextValues = nextDataset.values;
      const latestIndex = nextValues.length - 1;
      if (latestIndex < 0) return;

      const latestLabel = nextLabels[latestIndex];
      const latestValue = nextValues[latestIndex];
      const previousLabels = previousStreamLabelsRef.current;
      const droppedLabel =
        previousLabels.length === nextLabels.length ? previousLabels[0] : null;

      setStreamOutlierPoints((prev) => {
        let next = prev;

        if (droppedLabel !== null) {
          next = next.filter(([label]) => label !== droppedLabel);
        }

        if (latestValue < lowerFence || latestValue > upperFence) {
          next = [...next, [latestLabel, latestValue]];
        }

        return next;
      });

      previousStreamLabelsRef.current = nextLabels;
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
