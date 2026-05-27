import React, { useState } from "react";
import { openDownloadsFolder } from "../api.js";

/**
 * Shown after a successful download.
 * Displays the filename, Downloads path, and action buttons.
 */
export default function SuccessState({ result }) {
  const [copied, setCopied] = useState(false);
  const [openError, setOpenError] = useState(null);

  async function handleCopyPath() {
    const textToCopy = result.filePath ?? result.downloadsPath ?? "";
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — ignore silently
    }
  }

  async function handleOpenFolder() {
    setOpenError(null);
    try {
      await openDownloadsFolder();
    } catch {
      setOpenError(
        "Could not open the folder automatically. Path: " +
          (result.downloadsPath ?? "")
      );
    }
  }

  const fileName =
    result.fileName && result.fileName !== "Check your Downloads folder"
      ? result.fileName
      : null;

  return (
    <div className="success-state">
      {/* Animated SVG checkmark */}
      <div className="success-icon">
        <svg viewBox="0 0 52 52" className="checkmark" aria-hidden="true">
          <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
          <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>

      <h3 className="success-title">Download Complete!</h3>
      <p className="success-subtitle">Your WAV file has been saved to Downloads</p>

      {fileName && (
        <div className="success-file">
          <span className="file-icon" aria-hidden="true">🎵</span>
          <span className="file-name" title={fileName}>{fileName}</span>
        </div>
      )}

      {result.downloadsPath && (
        <div className="success-path">
          <span className="path-label">Saved to:</span>
          <code className="path-value" title={result.downloadsPath}>
            {result.downloadsPath}
          </code>
        </div>
      )}

      <div className="success-actions">
        <button className="btn btn-primary" onClick={handleOpenFolder}>
          📂 Open Downloads Folder
        </button>
        <button className="btn btn-ghost" onClick={handleCopyPath}>
          {copied ? "✓ Copied!" : "📋 Copy Path"}
        </button>
      </div>

      {openError && <p className="open-error">{openError}</p>}
    </div>
  );
}
