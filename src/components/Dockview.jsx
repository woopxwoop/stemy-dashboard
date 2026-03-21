import { DockviewReact } from "dockview-react";
import "dockview/dist/styles/dockview.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import EChart from "./EChart";
import RunExplorer from "./RunExplorer";
import { useRunManager } from "../hooks/useRunManager";

// ── Panel default ──────────────────────────────────────────────────────────────

const Default = (props) => (
  <div style={{ padding: 8 }}>{props.api.title ?? "Untitled panel"}</div>
);

// ── Renameable tab ─────────────────────────────────────────────────────────────
//
// Subscribes to api.onDidTitleChange so the label stays in sync when EChart
// calls api.setTitle() automatically on file load / stream start.
// Double-click to rename; Enter or blur to confirm; Escape to cancel.

function RenameableTab({ api }) {
  const [title, setTitle] = useState(api.title ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const disposable = api.onDidTitleChange(() => setTitle(api.title ?? ""));
    return () => disposable.dispose();
  }, [api]);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    const name = draft.trim();
    if (name) {
      api.setTitle(name);
      setTitle(name);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  return (
    <div className="dv-tab-custom" onDoubleClick={startEdit}>
      {editing ? (
        <input
          autoFocus
          className="dv-tab-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="dv-tab-title" title={title}>
          {title || "Untitled"}
        </span>
      )}
      <button
        className="dv-tab-close"
        title="Close panel"
        onClick={(e) => {
          e.stopPropagation();
          api.close();
        }}
      >
        ×
      </button>
    </div>
  );
}

const components = { default: Default, echart: EChart };
const tabComponents = { default: RenameableTab, echart: RenameableTab };

// Dockview tab bar height — button is overlaid at this offset from the top.
const TAB_BAR_HEIGHT = 38;

let panelCounter = 0;

// ── Dockview ──────────────────────────────────────────────────────────────────

function Dockview() {
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
      tabComponent: "echart",
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

  // ── Dockview ready ─────────────────────────────────────────────────────────

  const getReadyHandler = useCallback(
    (fileId) => {
      const instance = getInstance(fileId);
      if (!instance.onReady) {
        instance.onReady = (event) => {
          instance.api = event.api;

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

  const addPanel = useCallback(
    (fileId) => {
      const panel = addPanelToFile(fileId);
      if (panel) registerPanel(fileId, panel.id, panel.title);
    },
    [addPanelToFile, registerPanel],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <span className="app-toolbar__brand">Atheria</span>
      </header>

      <div className="app-workspace">
        <aside className="app-sidebar">
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
              {/* "+ New panel" button — overlaid at the right end of the tab bar */}
              <button
                className="dv-add-panel-btn"
                title="Add a new graph panel"
                onClick={() => addPanel(file.id)}
              >
                <span className="dv-add-panel-btn__icon">+</span>
                New panel
              </button>

              <DockviewReact
                className="dockview-theme-light"
                onReady={getReadyHandler(file.id)}
                components={components}
                tabComponents={tabComponents}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dockview;
