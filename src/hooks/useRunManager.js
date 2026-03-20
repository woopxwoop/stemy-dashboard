import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Manages the run-tree state (folders, files, active file) and exposes
 * stable callbacks for every tree operation. Dockview.jsx no longer owns
 * any of this state; it only owns the dockview instance map.
 *
 * @param {{
 *   onRevealFile: (fileId: string) => void,
 *   onFilesWillDelete: (files: object[]) => void,
 * }} callbacks
 */
export function useRunManager({ onRevealFile, onFilesWillDelete }) {
  // Start at 1 — the initial folder/file below already occupy _1.
  // These refs are only ever read/written in event handlers, never during render.
  const counters = useRef({ folder: 1, file: 1 });

  // Plain literals — no ref access, no side effects during render.
  const [folders, setFolders] = useState([
    { id: "folder_1", name: "Run group 1" },
  ]);
  const [files, setFiles] = useState([
    { id: "file_1", name: "Run 1", folderId: "folder_1", panels: [] },
  ]);
  const [activeFileId, setActiveFileId] = useState("file_1");

  // ── Derived ──────────────────────────────────────────────────────────────

  const treeData = useMemo(
    () =>
      folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        nodeType: "directory",
        children: files
          .filter((f) => f.folderId === folder.id)
          .map((file) => ({ id: file.id, name: file.name, nodeType: "file" })),
      })),
    [folders, files],
  );

  // ── Internal helpers ─────────────────────────────────────────────────────

  const revealFile = useCallback(
    (fileId) => {
      setActiveFileId(fileId);
      onRevealFile?.(fileId);
    },
    [onRevealFile],
  );

  // ── Public callbacks ─────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    ({ fileId }) => revealFile(fileId),
    [revealFile],
  );

  const handleAddDirectory = useCallback(() => {
    const id = `folder_${++counters.current.folder}`;
    setFolders((prev) => [
      ...prev,
      { id, name: `Run group ${counters.current.folder}` },
    ]);
  }, []);

  const handleAddFile = useCallback(
    (selectedNodeInfo) => {
      const targetFolderId =
        selectedNodeInfo?.nodeType === "directory"
          ? selectedNodeInfo.id
          : (selectedNodeInfo?.parentId ?? folders[0]?.id ?? null);

      if (!targetFolderId) return;

      const id = `file_${++counters.current.file}`;
      const name = `Run ${counters.current.file}`;
      setFiles((prev) => [
        ...prev,
        { id, name, folderId: targetFolderId, panels: [] },
      ]);
      revealFile(id);
    },
    [folders, revealFile],
  );

  const handleRename = useCallback(({ id, name }) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const handleDelete = useCallback(
    ({ ids }) => {
      const folderIds = ids.filter((id) => folders.some((f) => f.id === id));

      const fileIds = [
        ...ids.filter((id) => files.some((f) => f.id === id)),
        ...files.filter((f) => folderIds.includes(f.folderId)).map((f) => f.id),
      ];

      onFilesWillDelete?.(files.filter((f) => fileIds.includes(f.id)));

      setFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)));
      setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));

      if (ids.includes(activeFileId)) {
        const remaining = files.filter((f) => !fileIds.includes(f.id));
        setActiveFileId(remaining[0]?.id ?? null);
      }
    },
    [folders, files, activeFileId, onFilesWillDelete],
  );

  const handleMove = useCallback(({ dragIds, parentId }) => {
    setFiles((prev) =>
      prev.map((f) =>
        dragIds.includes(f.id) && parentId ? { ...f, folderId: parentId } : f,
      ),
    );
  }, []);

  const registerPanel = useCallback((fileId, panelId, panelName) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, panels: [...f.panels, { id: panelId, name: panelName }] }
          : f,
      ),
    );
  }, []);

  return {
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
  };
}
