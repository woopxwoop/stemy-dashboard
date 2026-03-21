import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tree } from "react-arborist";

const ROW_HEIGHT = 32;

const ExplorerCtx = createContext(null);

// ─── Node renderer ─────────────────────────────────────────────────────────────

function Node({ node, style, dragHandle }) {
  const { requestDelete, activeFileId } = useContext(ExplorerCtx);
  const isDir = node.isInternal;
  const isActive = !isDir && node.data.id === activeFileId;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={[
        "rex-row",
        isDir ? "rex-row--dir" : "rex-row--file",
        node.isSelected ? "rex-row--selected" : "",
        isActive ? "rex-row--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        if (isDir) node.toggle();
        node.select();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        node.edit();
      }}
    >
      {/* Colored pip for files; caret for directories */}
      {isDir ? (
        <span className="rex-icon">{node.isOpen ? "▾" : "▸"}</span>
      ) : (
        <span className="rex-file-pip" />
      )}

      {node.isEditing ? (
        <input
          autoFocus
          className="rex-rename-input"
          defaultValue={node.data.name}
          onBlur={(e) => node.submit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") node.submit(e.currentTarget.value);
            if (e.key === "Escape") node.reset();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="rex-label">{node.data.name}</span>
      )}

      <div className="rex-actions">
        <button
          className="rex-btn rex-btn--rename"
          type="button"
          tabIndex={-1}
          title="Rename (or double-click)"
          aria-label={`Rename ${node.data.name}`}
          onClick={(e) => {
            e.stopPropagation();
            node.edit();
          }}
        >
          ✎
        </button>
        <button
          className="rex-btn rex-btn--delete"
          type="button"
          tabIndex={-1}
          aria-label={`Delete ${node.data.name}`}
          onClick={(e) => {
            e.stopPropagation();
            requestDelete(node.id);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─── RunExplorer ───────────────────────────────────────────────────────────────

function RunExplorer({
  treeData,
  activeFileId,
  onFileSelect,
  onAddDirectory,
  onAddFile,
  onRename,
  onDelete,
  onMove,
}) {
  const wrapperRef = useRef(null);
  const [treeHeight, setTreeHeight] = useState(0);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setTreeHeight(Math.max(0, Math.floor(entry.contentRect.height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ctx = useMemo(
    () => ({
      requestDelete: (id) => onDelete?.({ ids: [id] }),
      activeFileId,
    }),
    [onDelete, activeFileId],
  );

  const handleSelect = (nodes) => {
    const node = nodes?.[0];
    if (!node) {
      setSelectedNodeInfo(null);
      return;
    }

    const isDir = node.isInternal;
    setSelectedNodeInfo({
      id: node.data.id,
      nodeType: isDir ? "directory" : "file",
      parentId: node.parent?.data?.id ?? null,
    });

    if (!isDir) onFileSelect?.({ fileId: node.data.id });
  };

  return (
    <ExplorerCtx.Provider value={ctx}>
      <div className="rex-shell">
        <div className="rex-header">
          <span className="rex-title">Runs</span>
          <div className="rex-header-actions">
            <button
              className="rex-add-btn"
              type="button"
              title="New run group"
              onClick={() => onAddDirectory?.(selectedNodeInfo)}
            >
              + Group
            </button>
            <button
              className="rex-add-btn rex-add-btn--primary"
              type="button"
              title="New run"
              onClick={() => onAddFile?.(selectedNodeInfo)}
            >
              + Run
            </button>
          </div>
        </div>

        <div className="rex-body" ref={wrapperRef}>
          {treeHeight > 0 && (
            <Tree
              data={treeData}
              rowHeight={ROW_HEIGHT}
              width="100%"
              height={treeHeight}
              openByDefault={true}
              padding={6}
              indent={14}
              onSelect={handleSelect}
              onRename={({ id, name }) => onRename?.({ id, name })}
              onDelete={({ ids }) => onDelete?.({ ids })}
              onMove={({ dragIds, parentId, index }) =>
                onMove?.({ dragIds, parentId, index })
              }
            >
              {Node}
            </Tree>
          )}
        </div>
      </div>
    </ExplorerCtx.Provider>
  );
}

export default RunExplorer;
