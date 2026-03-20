import { DockviewReact } from "dockview-react";
import "dockview/dist/styles/dockview.css";
import React, { useCallback, useRef } from "react";
import EChart from "./EChart";
import RunExplorer from "./RunExplorer";
import { useRunManager } from "../hooks/useRunManager";

const Default = (props) => (
  <div style={{ padding: 8 }}>{props.api.title ?? "Untitled panel"}</div>
);

const components = { default: Default, echart: EChart };

let panelCounter = 0;

// ── Dockview ─────────────────────────────────────────────────────────────────

function Dockview() {
  /**
   * Single map for all per-file dockview state.
   * Shape: Record<fileId, { api?: DockviewApi, onReady?: Function, el?: HTMLElement }>
   *
   * Previously three separate ref maps (dockviewApis, wrapperRefs, readyHandlers).
   */
  const fileInstances = useRef({});

  const getInstance = (fileId) => {
    fileInstances.current[fileId] ??= {};
    return fileInstances.current[fileId];
  };

  // ── Panel helpers ──────────────────────────────────────────────────────────

  const addPanelToFile = useCallback((fileId) => {
    const { api } = getInstance(fileId);
    if (!api) return null;

    const id = `panel_${++panelCounter}`;
    const title = `Graph ${panelCounter}`;
    const activePanel = api.activePanel;

    api.addPanel({
      id,
      title,
      component: "echart",
      params: { linkScope: fileId },
      position: activePanel
        ? { direction: "right", referencePanel: activePanel.id }
        : undefined,
    });

    requestAnimationFrame(() => {
      api.panels.forEach((p) =>
        p.api.setSize({ width: api.width / api.panels.length }),
      );
    });

    return { id, title };
  }, []);

  // ── Run manager ────────────────────────────────────────────────────────────

  const revealFile = useCallback((fileId) => {
    requestAnimationFrame(() => {
      const { api } = getInstance(fileId);
      if (api) api.layout(api.width, api.height);
    });
  }, []);

  const handleFilesWillDelete = useCallback((filesToDelete) => {
    filesToDelete.forEach(({ id: fileId, panels }) => {
      const { api } = getInstance(fileId);
      panels.forEach(({ id: panelId }) => {
        try {
          api?.getPanel(panelId)?.api.close();
        } catch (e) {
          console.debug("Panel already closed:", e);
        }
      });
      delete fileInstances.current[fileId];
    });
  }, []);

  const {
    files,
    activeFileId,
    treeData,
    handleFileSelect,
    handleAddDirectory,
    handleAddFile,
    handleRename,
    handleDelete,
    handleMove,
    registerPanel,
  } = useRunManager({
    onRevealFile: revealFile,
    onFilesWillDelete: handleFilesWillDelete,
  });

  // ── Dockview ready (one stable callback per file) ──────────────────────────

  const getReadyHandler = useCallback(
    (fileId) => {
      const instance = getInstance(fileId);

      if (!instance.onReady) {
        instance.onReady = (event) => {
          instance.api = event.api;

          // Enforce light theme on the inner dockview element.
          const inner = instance.el?.querySelector(
            "[class*='dockview-theme-']",
          );
          if (inner) {
            inner.className =
              inner.className.replace(/dockview-theme-\S+/g, "").trim() +
              " dockview-theme-light";
          }

          const panel = addPanelToFile(fileId);
          if (panel) registerPanel(fileId, panel.id, panel.title);
        };
      }

      return instance.onReady;
    },
    [addPanelToFile, registerPanel],
  );

  // ── Top toolbar ────────────────────────────────────────────────────────────

  const addPanel = useCallback(() => {
    if (!activeFileId) return;
    const panel = addPanelToFile(activeFileId);
    if (panel) registerPanel(activeFileId, panel.id, panel.title);
  }, [activeFileId, addPanelToFile, registerPanel]);

  // ── Render ─────────────────────────────────────────────────────────────────

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
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          minHeight: 0,
          height: "100%",
        }}
      >
        <aside
          style={{
            borderRight: "1px solid rgba(128, 128, 128, 0.35)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <RunExplorer
            treeData={treeData}
            activeFileId={activeFileId}
            onFileSelect={handleFileSelect}
            onAddDirectory={handleAddDirectory}
            onAddFile={handleAddFile}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </aside>

        {/* All dockviews stacked; only the active file's is visible */}
        <div
          style={{
            position: "relative",
            height: "100%",
            width: "100%",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {files.map((file) => (
            <div
              key={file.id}
              ref={(el) => {
                getInstance(file.id).el = el;
              }}
              style={{
                position: "absolute",
                inset: 0,
                visibility: file.id === activeFileId ? "visible" : "hidden",
                pointerEvents: file.id === activeFileId ? "auto" : "none",
              }}
            >
              <DockviewReact
                className="dockview-theme-light"
                onReady={getReadyHandler(file.id)}
                components={components}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dockview;
