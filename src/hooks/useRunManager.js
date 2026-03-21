import { useCallback, useMemo, useRef, useState } from "react";
import { groupApiRuns } from "../api/runsApi";

export function useRunManager({ onRevealFile, onFilesWillDelete }) {
  const counters = useRef({ folder: 1, file: 1 });

  const [folders, setFolders] = useState([
    { id: "folder_1", name: "Run group 1" },
  ]);
  const [files, setFiles] = useState([
    {
      id: "file_1",
      name: "Run 1",
      folderId: "folder_1",
      panels: [],
      runId: null,
    },
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

  // ── Internal ──────────────────────────────────────────────────────────────

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
        { id, name, folderId: targetFolderId, panels: [], runId: null },
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

  /**
   * Syncs the sidebar tree with a fresh API runs response.
   *
   * - Runs already present (matched by runId) have their name updated in place.
   * - New runs are appended under their group folder (created if needed).
   * - Runs that no longer appear in the API response are left alone — the user
   *   can delete them manually.
   *
   * Calling this repeatedly is safe: it never creates duplicate entries.
   *
   * @param {ApiRun[]} apiRuns — raw array from fetchRuns()
   */
  const loadApiRuns = useCallback(
    (apiRuns) => {
      if (!Array.isArray(apiRuns) || apiRuns.length === 0) return;

      const groups = groupApiRuns(apiRuns);

      // Compute next folders — reuse by name, create if missing.
      const nextFolders = [...folders];
      const folderByName = new Map(nextFolders.map((f) => [f.name, f]));

      for (const { groupName } of groups) {
        if (!folderByName.has(groupName)) {
          const folder = {
            id: `folder_${++counters.current.folder}`,
            name: groupName,
          };
          nextFolders.push(folder);
          folderByName.set(groupName, folder);
        }
      }

      // Compute next files — update names in place, append new runs only.
      const existingByRunId = new Map(
        files.filter((f) => f.runId).map((f) => [f.runId, f]),
      );

      const nextFiles = files.map((f) => {
        const apiRun = apiRuns.find((r) => r.id === f.runId);
        return apiRun && apiRun.name !== f.name
          ? { ...f, name: apiRun.name }
          : f;
      });

      let firstNewFileId = null;

      for (const { groupName, runs } of groups) {
        const folderId = folderByName.get(groupName)?.id;
        for (const run of runs) {
          if (existingByRunId.has(run.id)) continue;
          const fileId = `file_${++counters.current.file}`;
          if (!firstNewFileId) firstNewFileId = fileId;
          nextFiles.push({
            id: fileId,
            name: run.name,
            folderId,
            panels: [],
            runId: run.id,
          });
        }
      }

      setFolders(nextFolders);
      setFiles(nextFiles);

      if (firstNewFileId) setTimeout(() => revealFile(firstNewFileId), 0);
    },
    [folders, files, revealFile],
  );

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
    loadApiRuns,
  };
}
