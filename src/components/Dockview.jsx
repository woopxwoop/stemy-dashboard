import { DockviewReact } from "dockview-react";
import "dockview/dist/styles/dockview.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import EChart from "./EChart";
import RunExplorer from "./RunExplorer";
import AgentAvatar from "./AgentAvatar";
import { useRunManager } from "../hooks/useRunManager";
import { fetchRuns } from "../api/runsApi";

// ── Panel default ──────────────────────────────────────────────────────────────

const Default = (props) => (
  <div style={{ padding: 8 }}>{props.api.title ?? "Untitled panel"}</div>
);

// ── Renameable tab ─────────────────────────────────────────────────────────────

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
    const n = draft.trim();
    if (n) {
      api.setTitle(n);
      setTitle(n);
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

let panelCounter = 0;

// ── Dockview ──────────────────────────────────────────────────────────────────

function Dockview() {
  const fileInstances = useRef({});

  const getInstance = (fileId) => {
    fileInstances.current[fileId] ??= {};
    return fileInstances.current[fileId];
  };

  // ── Agent state (will be driven by real agent events later) ───────────────
  // "idle" | "thinking" | "active" | "alert"
  const [agentState, setAgentState] = useState("idle");

  // ── Panel helpers ──────────────────────────────────────────────────────────

  const addPanelToFile = useCallback((fileId, runId = null) => {
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
      params: { linkScope: fileId, runId: runId ?? null },
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
    loadApiRuns,
  } = useRunManager({
    onRevealFile: revealFile,
    onFilesWillDelete: handleFilesWillDelete,
  });

  // ── Auto-load runs on mount ────────────────────────────────────────────────

  useEffect(() => {
    setAgentState("thinking");
    fetchRuns()
      .then((runs) => {
        loadApiRuns(runs);
        setAgentState("active");
        // Return to idle after a beat
        setTimeout(() => setAgentState("idle"), 2000);
      })
      .catch((err) => {
        console.error("Failed to load runs:", err);
        setAgentState("alert");
        setTimeout(() => setAgentState("idle"), 3000);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          const file = files.find((f) => f.id === fileId);
          const panel = addPanelToFile(fileId, file?.runId ?? null);
          if (panel) registerPanel(fileId, panel.id, panel.title);
        };
      }
      return instance.onReady;
    },
    [addPanelToFile, registerPanel, files],
  );

  const addPanel = useCallback(
    (fileId) => {
      const file = files.find((f) => f.id === fileId);
      const panel = addPanelToFile(fileId, file?.runId ?? null);
      if (panel) registerPanel(fileId, panel.id, panel.title);
    },
    [files, addPanelToFile, registerPanel],
  );

  // ── Load runs from API (manual refresh) ───────────────────────────────────

  const [apiLoadState, setApiLoadState] = useState("idle");

  const handleLoadApiRuns = useCallback(async () => {
    setApiLoadState("loading");
    setAgentState("thinking");
    try {
      const runs = await fetchRuns();
      loadApiRuns(runs);
      setApiLoadState("idle");
      setAgentState("active");
      setTimeout(() => setAgentState("idle"), 2000);
    } catch (err) {
      console.error("Failed to load runs:", err);
      setApiLoadState("error");
      setAgentState("alert");
      setTimeout(() => {
        setApiLoadState("idle");
        setAgentState("idle");
      }, 3000);
    }
  }, [loadApiRuns]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <span className="app-toolbar__brand">SteMy</span>
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
            onLoadApiRuns={handleLoadApiRuns}
            apiLoadState={apiLoadState}
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

      {/* ── Agent avatar — fixed, draggable ── */}
      <AgentAvatar state={agentState} />
    </div>
  );
}

export default Dockview;
