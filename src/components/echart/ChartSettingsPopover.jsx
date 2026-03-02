import React from "react";
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
  return (
    <div ref={settingsRef} className="chart-settings-popover" role="dialog">
      <div className="chart-settings-header">
        <span>Panel settings</span>
        <button
          className="control-button chart-settings-close"
          type="button"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>

      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Data source</span>
        <div className="toolbar-group toolbar-group--file chart-settings-file-row">
          <input
            className="control-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            onChange={onFileChange}
          />
          <span className="file-name">
            {selectedFileName || "No file loaded"}
          </span>
        </div>
      </div>

      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Bounds</span>
        <div className="toolbar-group toolbar-group--bounds chart-settings-bounds-grid">
          <label className="toolbar-label chart-settings-label">
            Lower bound
            <input
              className="control-input"
              type="number"
              value={manualBounds.lower}
              placeholder="Auto (IQR)"
              onChange={(event) =>
                onManualBoundsChange({
                  ...manualBounds,
                  lower: event.target.value,
                })
              }
            />
          </label>

          <label className="toolbar-label chart-settings-label">
            Upper bound
            <input
              className="control-input"
              type="number"
              value={manualBounds.upper}
              placeholder="Auto (IQR)"
              onChange={(event) =>
                onManualBoundsChange({
                  ...manualBounds,
                  upper: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="toolbar-group chart-settings-actions">
          <button className="control-button" onClick={onResetBounds}>
            Reset range
          </button>
        </div>
      </div>

      <div className="chart-settings-section">
        <span className="chart-settings-section-title">Streaming</span>
        <div className="toolbar-group chart-settings-actions">
          <label className="toolbar-label chart-settings-label chart-settings-select-label">
            Preset
            <select
              className="control-input chart-settings-select"
              value={streamPresetKey}
              onChange={(event) => onPresetChange(event.target.value)}
            >
              {Object.entries(STREAM_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar-group toolbar-group--stream chart-settings-actions">
          {!isStreaming ? (
            <button className="control-button" onClick={onStartStream}>
              Start simulated stream
            </button>
          ) : (
            <button className="control-button" onClick={onStopStream}>
              Stop simulated stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChartSettingsPopover;
