import React, { useState, useRef, useEffect } from "react";
import { uploadCompletedSong } from "../api.js";

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"];
const MAX_SIZE_BYTES       = 250 * 1024 * 1024; // 250 MB

/**
 * Modal for uploading a completed song file.
 *
 * Props:
 *   songId          — number
 *   preselectedFile — File | null
 *   onClose         — () => void
 *   onSuccess       — () => void  (called after successful upload)
 *   showToast       — (msg, type) => void
 */
export default function CompletedSongUploadModal({
  songId,
  preselectedFile,
  onClose,
  onSuccess,
  showToast,
}) {
  const [file,         setFile]         = useState(preselectedFile || null);
  const [versionLabel, setVersionLabel] = useState("");
  const [notes,        setNotes]        = useState("");
  const [isPrimary,    setIsPrimary]    = useState(true);
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [uploadState,  setUploadState]  = useState("idle"); // idle | uploading | success | error
  const [errorMsg,     setErrorMsg]     = useState("");
  const [sizeWarning,  setSizeWarning]  = useState(false);

  const fileInputRef = useRef(null);

  // If a preselected file is given, check its size
  useEffect(() => {
    if (preselectedFile) {
      setFile(preselectedFile);
      setSizeWarning(preselectedFile.size > MAX_SIZE_BYTES);
    }
  }, [preselectedFile]);

  function selectFile(f) {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      showToast(`File type "${ext}" is not supported.`, "error");
      return;
    }
    setFile(f);
    setSizeWarning(f.size > MAX_SIZE_BYTES);
    setErrorMsg("");
  }

  function handleFileInputChange(e) {
    selectFile(e.target.files?.[0] || null);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    selectFile(e.dataTransfer.files?.[0] || null);
  }

  async function handleUpload() {
    if (!file) { setErrorMsg("Please select a file."); return; }
    if (uploadState === "uploading") return;

    setUploadState("uploading");
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file",         file);
    formData.append("versionLabel", versionLabel.trim());
    formData.append("notes",        notes.trim());
    formData.append("isPrimary",    String(isPrimary));

    try {
      await uploadCompletedSong(songId, formData);
      setUploadState("success");
      setTimeout(() => onSuccess(), 600);
    } catch (err) {
      setUploadState("error");
      const msg = err.message || "Upload failed.";
      setErrorMsg(msg);
      showToast(msg, "error");
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  const isLoading = uploadState === "uploading";
  const isSuccess = uploadState === "success";

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--upload" role="dialog" aria-modal="true" aria-label="Upload completed song">
        <div className="modal__header">
          <span className="modal__title">Upload Completed Song</span>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          {/* File drop area */}
          <div
            className={`upload-drop-area${isDragOver ? " upload-drop-area--over" : ""}${file ? " upload-drop-area--has-file" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />

            {file ? (
              <div className="upload-drop-area__file-info">
                <span className="upload-drop-area__file-icon">🎵</span>
                <div>
                  <div className="upload-drop-area__file-name">{file.name}</div>
                  <div className="upload-drop-area__file-size">{formatBytes(file.size)}</div>
                </div>
                <button
                  className="upload-drop-area__clear"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setSizeWarning(false); }}
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="upload-drop-area__empty">
                <span className="upload-drop-area__icon">☁</span>
                <span className="upload-drop-area__text">
                  {isDragOver ? "Drop to select" : "Drag & drop or click to browse"}
                </span>
                <span className="upload-drop-area__formats">
                  {ACCEPTED_EXTENSIONS.join("  ")}
                </span>
              </div>
            )}
          </div>

          {sizeWarning && (
            <div className="upload-size-warning">
              ⚠ File is larger than 250 MB — upload may be slow or rejected by the server.
            </div>
          )}

          {/* Version label */}
          <div className="field">
            <label className="field__label">Version Label</label>
            <input
              className="field__input"
              placeholder="e.g. Demo, First Take, Final Mix, Master"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              maxLength={150}
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div className="field">
            <label className="field__label">Notes</label>
            <textarea
              className="field__input"
              placeholder="Optional notes about this recording…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isLoading}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Set as primary */}
          <label className="upload-primary-check">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isLoading}
            />
            <span>Set as primary version</span>
          </label>

          {errorMsg && (
            <div className="field__error upload-error">{errorMsg}</div>
          )}
        </div>

        <div className="modal__footer">
          <button
            className="btn btn--ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>

          <button
            className={`btn ${isSuccess ? "btn--accent" : "btn--grad"}${isLoading ? " btn--loading" : ""}`}
            onClick={handleUpload}
            disabled={isLoading || isSuccess || !file}
          >
            {isLoading && <span className="spinner" />}
            {isSuccess ? "✓ Uploaded!" : isLoading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
