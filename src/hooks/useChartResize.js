import { useEffect, useState } from "react";

/**
 * Watches a wrapper element for size changes and keeps the ECharts instance
 * in sync. Returns the latest {width, height} so the style prop stays current.
 *
 * @param {React.RefObject<HTMLElement>} wrapperRef
 * @param {object|null} chartInstance - ECharts instance from onChartReady
 * @returns {{ width: number, height: number }}
 */
export function useChartResize(wrapperRef, chartInstance) {
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let frameId = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        setChartSize({ width, height });
        chartInstance?.resize({ width, height });
      });
    });

    observer.observe(wrapper);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [wrapperRef, chartInstance]);

  return chartSize;
}
