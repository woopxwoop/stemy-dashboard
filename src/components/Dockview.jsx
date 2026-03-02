import { DockviewReact } from "dockview-react";
import "dockview/dist/styles/dockview.css";
import React, { useRef } from "react";
import EChart from "./EChart";

const Default = (props) => {
  return (
    <div style={{ padding: 8 }}>{props.api.title ?? "Untitled panel"}</div>
  );
};

const components = {
  default: Default,
  echart: EChart,
};

function Dockview() {
  const dockviewApiRef = useRef(null);
  const panelCountRef = useRef(0);
  const containerRef = useRef(null);

  const onReady = (event) => {
    dockviewApiRef.current = event.api;

    // Find and retheme the inner div dockview controls
    const inner = containerRef.current?.querySelector(
      "[class*='dockview-theme-']",
    );
    if (inner) {
      inner.className =
        inner.className.replace(/dockview-theme-\S+/g, "").trim() +
        " dockview-theme-light";
    }
    // optional initial panel
    panelCountRef.current += 1;
    event.api.addPanel({
      id: `panel_${panelCountRef.current}`,
      title: `Graph ${panelCountRef.current}`,
      component: "echart",
    });
  };

  const addPanel = () => {
    const api = dockviewApiRef.current;
    if (!api) return;

    panelCountRef.current += 1;
    const id = `panel_${panelCountRef.current}`;
    const activePanel = api.activePanel;

    api.addPanel({
      id,
      title: `Graph ${panelCountRef.current}`,
      component: "echart",
      position: activePanel
        ? {
            direction: "right",
            referencePanel: activePanel.id,
          }
        : undefined,
    });

    // After adding, equalize all panel sizes
    requestAnimationFrame(() => {
      api.panels.forEach((panel) => {
        panel.api.setSize({ width: api.width / api.panels.length });
      });
    });
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        className="toolbar"
        style={{ borderBottom: "1px solid rgba(128, 128, 128, 0.35)" }}
      >
        <button className="control-button" onClick={addPanel}>
          Add panel
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}
      >
        <DockviewReact
          className="dockview-theme-light"
          onReady={onReady}
          components={components}
        />
      </div>
    </div>
  );
}

export default Dockview;
