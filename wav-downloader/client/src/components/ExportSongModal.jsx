import React, { useEffect, useState } from "react";
import {
  getSongExportPreview,
  getSongPackagePreview,
  downloadSongExportTxt,
  downloadSongPackage,
  saveSongPackage,
} from "../api.js";
import SvgExportDocument from "./SvgExportDocument.jsx";
import SvgPackageBox     from "./SvgPackageBox.jsx";
import PackagePreviewTree from "./PackagePreviewTree.jsx";

/**
 * Modal with two tabs: "Text Export" and "Full Package".
 *
 * Props:
 *   songId    — number
 *   songTitle — string
 *   onClose   — () => void
 *   showToast — (msg, type) => void
 */
export default function ExportSongModal({ songId, songTitle, onClose, showToast }) {
  const [activeTab,      setActiveTab]      = useState("text");
  const [textPreview,    setTextPreview]    = useState(null);
  const [packagePreview, setPackagePreview] = useState(null);
  const [loadingText,    setLoadingText]    = useState(false);
  const [loadingPkg,     setLoadingPkg]     = useState(false);
  const [downloading,    setDownloading]    = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saveResult,     setSaveResult]     = useState(null);
  const [copyDone,       setCopyDone]       = useState(false);

  // Load text preview when text tab is active
  useEffect(() => {
    if (activeTab === "text" && textPreview === null && !loadingText) {
      setLoadingText(true);
      getSongExportPreview(songId)
        .then((data) => setTextPreview(data.text || ""))
        .catch((err) => {
          showToast(err.message || "Could not load export preview.", "error");
          setTextPreview("");
        })
        .finally(() => setLoadingText(false));
    }
  }, [activeTab, songId, textPreview, loadingText, showToast]);

  // Load package preview when package tab is active
  useEffect(() => {
    if (activeTab === "package" && packagePreview === null && !loadingPkg) {
      setLoadingPkg(true);
      getSongPackagePreview(songId)
        .then((data) => setPackagePreview(data))
        .catch((err) => {
          showToast(err.message || "Could not load package preview.", "error");
          setPackagePreview({ filesIncluded: [], warnings: [] });
        })
        .finally(() => setLoadingPkg(false));
    }
  }, [activeTab, songId, packagePreview, loadingPkg, showToast]);

  async function handleDownloadTxt() {
    try {
      await downloadSongExportTxt(songId, songTitle);
    } catch (err) {
      showToast(err.message || "Download failed.", "error");
    }
  }

  async function handleCopyText() {
    if (!textPreview) return;
    try {
      await navigator.clipboard.writeText(textPreview);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      showToast("Could not copy to clipboard.", "error");
    }
  }

  async function handleDownloadPackage() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadSongPackage(songId, songTitle);
      showToast("Package downloaded!", "success");
    } catch (err) {
      showToast(err.message || "Download failed.", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSavePackage() {
    if (saving) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await saveSongPackage(songId);
      if (result.success) {
        setSaveResult(result);
        showToast(`Saved: ${result.hostRelativePath || result.fileName}`, "success");
      } else {
        showToast(result.error || "Save failed.", "error");
      }
    } catch (err) {
      showToast(err.message || "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal export-modal" role="dialog" aria-modal="true" aria-label="Export Song">
        <div className="modal__header">
          <span className="modal__title">Export — {songTitle}</span>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="export-tabs">
          <button
            className={`export-tab${activeTab === "text" ? " export-tab--active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            <SvgExportDocument size={16} />
            Text Export
          </button>
          <button
            className={`export-tab${activeTab === "package" ? " export-tab--active" : ""}`}
            onClick={() => setActiveTab("package")}
          >
            <SvgPackageBox size={16} />
            Full Package
          </button>
        </div>

        <div className="modal__body export-modal__body">
          {/* ── Text Export Tab ──────────────────────────────────────────── */}
          {activeTab === "text" && (
            <div className="export-tab-panel">
              {loadingText ? (
                <div className="export-loading">
                  <span className="spinner" />
                  <span>Generating preview…</span>
                </div>
              ) : (
                <pre className="export-preview">{textPreview}</pre>
              )}

              <div className="export-tab-panel__actions">
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={handleDownloadTxt}
                  disabled={loadingText}
                >
                  ↓ Download TXT
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={handleCopyText}
                  disabled={loadingText || !textPreview}
                >
                  {copyDone ? "✓ Copied!" : "⎘ Copy Text"}
                </button>
              </div>
            </div>
          )}

          {/* ── Full Package Tab ─────────────────────────────────────────── */}
          {activeTab === "package" && (
            <div className="export-tab-panel">
              {loadingPkg ? (
                <div className="export-loading">
                  <span className="spinner" />
                  <span>Building package preview…</span>
                </div>
              ) : (
                <PackagePreviewTree preview={packagePreview} />
              )}

              {saveResult && (
                <div className="export-save-result">
                  <span className="export-save-result__icon">✓</span>
                  <div>
                    <div className="export-save-result__label">Saved to:</div>
                    <code className="export-save-result__path">
                      {saveResult.hostRelativePath || saveResult.containerPath}
                    </code>
                  </div>
                </div>
              )}

              <div className="export-tab-panel__actions">
                <button
                  className={`btn btn--grad btn--sm${downloading ? " btn--loading" : ""}`}
                  onClick={handleDownloadPackage}
                  disabled={downloading || loadingPkg}
                >
                  {downloading && <span className="spinner" />}
                  {downloading ? "Generating ZIP…" : "↓ Download Full Package"}
                </button>

                <button
                  className={`btn btn--ghost btn--sm${saving ? " btn--loading" : ""}`}
                  onClick={handleSavePackage}
                  disabled={saving || loadingPkg}
                  title="Save ZIP to ./exports folder"
                >
                  {saving && <span className="spinner" />}
                  {saving ? "Saving…" : "💾 Save to ./exports"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
