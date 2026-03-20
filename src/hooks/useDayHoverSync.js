import { useEffect, useId, useRef } from "react";
import { DAY_HOVER_EVENT } from "../constants/events";

/**
 * Keeps all EChart panels that share a linkScope in sync while hovering.
 * When the user hovers over a day in one chart, the same day is highlighted
 * in every other chart with the same scope.
 *
 * @param {{ chartInstance: object|null, linkScope: string, dayToDataIndicesRef: React.MutableRefObject<Map> }} params
 */
export function useDayHoverSync({
  chartInstance,
  linkScope,
  dayToDataIndicesRef,
}) {
  // useId() is pure and stable — safe to call during render, unlike Math.random().
  const reactId = useId();
  const chartIdRef = useRef(`chart_${reactId}`);
  // Guards against infinite dispatch loops when programmatically showing a tip.
  const suppressRef = useRef(false);

  useEffect(() => {
    if (!chartInstance) return;

    const hideTip = () => {
      suppressRef.current = true;
      chartInstance.dispatchAction({ type: "hideTip" });
      setTimeout(() => {
        suppressRef.current = false;
      }, 0);
    };

    // ── Outbound: broadcast which day the pointer is on ──────────────────────

    const onAxisPointerUpdate = (event) => {
      if (suppressRef.current) return;
      const axisValue = event?.axesInfo?.[0]?.value;
      if (!Number.isFinite(axisValue)) return;

      window.dispatchEvent(
        new CustomEvent(DAY_HOVER_EVENT, {
          detail: {
            source: chartIdRef.current,
            day: Math.max(1, Math.floor(axisValue) + 1),
            scope: linkScope,
          },
        }),
      );
    };

    const onGlobalOut = () => {
      window.dispatchEvent(
        new CustomEvent(DAY_HOVER_EVENT, {
          detail: { source: chartIdRef.current, day: null, scope: linkScope },
        }),
      );
    };

    // ── Inbound: react to other charts' broadcasts ───────────────────────────

    const onDayHover = (event) => {
      const { source, day, scope } = event.detail ?? {};
      if (source === chartIdRef.current) return; // ignore own events
      if (scope !== linkScope) return; // ignore other scopes

      if (!Number.isFinite(day)) {
        hideTip();
        return;
      }

      const dataIndex = (dayToDataIndicesRef.current.get(day) ?? [])[0];
      if (!Number.isInteger(dataIndex)) {
        hideTip();
        return;
      }

      suppressRef.current = true;
      chartInstance.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex,
      });
      setTimeout(() => {
        suppressRef.current = false;
      }, 0);
    };

    chartInstance.on("updateAxisPointer", onAxisPointerUpdate);
    chartInstance.on("globalout", onGlobalOut);
    window.addEventListener(DAY_HOVER_EVENT, onDayHover);

    return () => {
      chartInstance.off("updateAxisPointer", onAxisPointerUpdate);
      chartInstance.off("globalout", onGlobalOut);
      window.removeEventListener(DAY_HOVER_EVENT, onDayHover);
    };
  }, [chartInstance, linkScope, dayToDataIndicesRef]);
}
