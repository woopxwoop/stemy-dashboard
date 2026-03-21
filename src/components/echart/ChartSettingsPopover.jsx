import React, { useId } from "react";
import { STREAM_PRESETS } from "../../utils/simulateStream";

function ChartSettingsPopover({
  settingsRef,
  selectedFileName,
  onClose,
  onFileChange,
  manualBounds,
  onManualBoundsChange,
  onResetBounds,
  streamPresetKey,
  onPresetChange,
  isStreaming,
  onStartStream,
  onStopStream,
}) {
  // useId gives a stable, unique id for the hidden file input ↔ label pair.
  const fileInputId = useId();

  return (
    <div ref={settingsRef} className="chart-settings-popover" role="dialog">
      <div className="chart-settings-header">
        <span>Panel settings</span>
        <button
          className="chart-settings-close"
          type="button"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>

      {/* ── Data source ───────────────────────────────────────────── */}
      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Data source</span>

        {/* Hidden native input; the visible button is a <label> */}
        <input
          id={fileInputId}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.value = "";
          }}
          onChange={onFileChange}
        />

        <div className="chart-settings-file-row">
          <label htmlFor={fileInputId} className="chart-settings-file-btn">
            Choose file
          </label>
          <span className="chart-settings-file-name">
            {selectedFileName || "No file loaded"}
          </span>
        </div>
      </div>

      {/* ── Bounds ────────────────────────────────────────────────── */}
      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Bounds</span>
        <div className="chart-settings-bounds-grid">
          <label className="chart-settings-label">
            Lower bound
            <input
              className="control-input"
              type="number"
              value={manualBounds.lower}
              placeholder="Auto (IQR)"
              onChange={(e) =>
                onManualBoundsChange({ ...manualBounds, lower: e.target.value })
              }
            />
          </label>
          <label className="chart-settings-label">
            Upper bound
            <input
              className="control-input"
              type="number"
              value={manualBounds.upper}
              placeholder="Auto (IQR)"
              onChange={(e) =>
                onManualBoundsChange({ ...manualBounds, upper: e.target.value })
              }
            />
          </label>
        </div>
        <div className="chart-settings-actions">
          <button className="chart-settings-action-btn" onClick={onResetBounds}>
            Reset range
          </button>
        </div>
      </div>

      {/* ── Streaming ─────────────────────────────────────────────── */}
      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Streaming</span>
        <label className="chart-settings-label chart-settings-select-label">
          Preset
          <select
            className="chart-settings-select"
            value={streamPresetKey}
            onChange={(e) => onPresetChange(e.target.value)}
          >
            {Object.entries(STREAM_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <div className="chart-settings-actions">
          {!isStreaming ? (
            <button
              className="chart-settings-action-btn chart-settings-action-btn--primary"
              onClick={onStartStream}
            >
              Start stream
            </button>
          ) : (
            <button
              className="chart-settings-action-btn chart-settings-action-btn--danger"
              onClick={onStopStream}
            >
              Stop stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChartSettingsPopover;
