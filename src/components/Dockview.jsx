import { DockviewReact } from "dockview-react";
import "dockview/dist/styles/dockview.css";
import React, { useCallback, useMemo, useRef, useState } from "react";
import EChart from "./EChart";
import RunExplorer from "./RunExplorer";

const Default = (props) => (
  <div style={{ padding: 8 }}>{props.api.title ?? "Untitled panel"}</div>
);

const components = { default: Default, echart: EChart };

let panelCounter = 0;
let folderCounter = 0;
let fileCounter = 0;

function Dockview() {
  const dockviewApis = useRef({}); // fileId → dockview api
  const wrapperRefs = useRef({}); // fileId → wrapper DOM element
  const readyHandlers = useRef({}); // fileId → stable onReady callback

  const initialFolderId = useMemo(() => `folder_${++folderCounter}`, []);
  const initialFileId = useMemo(() => `file_${++fileCounter}`, []);

  const [folders, setFolders] = useState([
    { id: initialFolderId, name: "Run group 1" },
  ]);

  // Each file IS a dockview. panels[] tracks what's inside it.
  const [files, setFiles] = useState([
    { id: initialFileId, name: "Run 1", folderId: initialFolderId, panels: [] },
  ]);

  const [activeFileId, setActiveFileId] = useState(initialFileId);

  // ── Tree data ──────────────────────────────────────────────────────────────

  const treeData = useMemo(
    () =>
      folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        nodeType: "directory",
        children: files
          .filter((f) => f.folderId === folder.id)
          .map((file) => ({
            id: file.id,
            name: file.name,
            nodeType: "file",
          })),
      })),
    [folders, files],
  );

  // ── Panel helpers ──────────────────────────────────────────────────────────

  const addPanelToFile = useCallback((fileId) => {
    const api = dockviewApis.current[fileId];
    if (!api) return;

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

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, panels: [...f.panels, { id, name: title }] }
          : f,
      ),
    );
  }, []);

  // ── Dockview ready (one per file) ──────────────────────────────────────────

  const getReadyHandler = useCallback(
    (fileId) => {
      if (!readyHandlers.current[fileId]) {
        readyHandlers.current[fileId] = (event) => {
          dockviewApis.current[fileId] = event.api;

          const wrapper = wrapperRefs.current[fileId];
          const inner = wrapper?.querySelector("[class*='dockview-theme-']");
          if (inner) {
            inner.className =
              inner.className.replace(/dockview-theme-\S+/g, "").trim() +
              " dockview-theme-light";
          }

          addPanelToFile(fileId);
        };
      }
      return readyHandlers.current[fileId];
    },
    [addPanelToFile],
  );

  const revealFile = useCallback((fileId) => {
    setActiveFileId(fileId);
    requestAnimationFrame(() => {
      const api = dockviewApis.current[fileId];
      if (api) api.layout(api.width, api.height);
    });
  }, []);

  // ── RunExplorer callbacks ──────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    ({ fileId }) => revealFile(fileId),
    [revealFile],
  );

  // Add a top-level folder
  const handleAddDirectory = useCallback(() => {
    const id = `folder_${++folderCounter}`;
    setFolders((prev) => [...prev, { id, name: `Run group ${folderCounter}` }]);
  }, []);

  // Add a new file/dockview into the selected or first folder
  const handleAddFile = useCallback(
    (selectedNodeInfo) => {
      const targetFolderId =
        selectedNodeInfo?.nodeType === "directory"
          ? selectedNodeInfo.id
          : (selectedNodeInfo?.parentId ?? folders[0]?.id ?? null);

      if (!targetFolderId) return;

      const id = `file_${++fileCounter}`;
      const name = `Run ${fileCounter}`;
      setFiles((prev) => [
        ...prev,
        { id, name, folderId: targetFolderId, panels: [] },
      ]);
      revealFile(id);
    },
    [folders, revealFile],
  );

  const handleRename = useCallback(({ id, name }) => {
    // Could be a folder or a file
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const handleDelete = useCallback(
    ({ ids }) => {
      // Delete folders → also delete their files and dockviews
      const folderIds = ids.filter((id) => folders.some((f) => f.id === id));
      const fileIds = [
        ...ids.filter((id) => files.some((f) => f.id === id)),
        ...files.filter((f) => folderIds.includes(f.folderId)).map((f) => f.id),
      ];

      fileIds.forEach((fileId) => {
        files
          .find((f) => f.id === fileId)
          ?.panels.forEach((p) => {
            try {
              dockviewApis.current[fileId]?.getPanel(p.id)?.api.close();
            } catch (e) {
              console.debug("Panel already closed:", e);
            }
          });
        delete dockviewApis.current[fileId];
        delete readyHandlers.current[fileId];
        delete wrapperRefs.current[fileId];
      });

      setFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)));
      setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));

      if (ids.includes(activeFileId)) {
        const remaining = files.filter((f) => !fileIds.includes(f.id));
        setActiveFileId(remaining[0]?.id ?? null);
      }
    },
    [folders, files, activeFileId],
  );

  // Dragging a file to a folder reassigns its folderId
  const handleMove = useCallback(({ dragIds, parentId }) => {
    // Only allow moving files (not folders) into a folder
    setFiles((prev) =>
      prev.map((f) =>
        dragIds.includes(f.id) && parentId ? { ...f, folderId: parentId } : f,
      ),
    );
  }, []);

  // ── Top toolbar ────────────────────────────────────────────────────────────

  const addPanel = useCallback(() => {
    if (activeFileId) addPanelToFile(activeFileId);
  }, [activeFileId, addPanelToFile]);

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
                wrapperRefs.current[file.id] = el;
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
