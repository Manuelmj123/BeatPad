import React, { useState } from "react";
import { getBeatDownloadUrl, getBeatStreamUrl, detachBeat, openBeatFolder } from "../api.js";
import SvgCheckmark from "./SvgCheckmark.jsx";

function formatBytes(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AudioFormatIcon({ ext = "wav" }) {
  const label = ext.toUpperCase().slice(0, 4);
  // Colour per format
  const colours = {
    wav:  "#4ade80", mp3:  "#60a5fa", flac: "#a78bfa",
    aac:  "#f59e0b", m4a:  "#fb923c", ogg:  "#34d399",
  };
  const color = colours[ext.toLowerCase()] || "#94a3b8";
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill={`${color}22`} />
      <text x="4" y="20" fontSize={label.length > 3 ? 9 : 11} fontWeight="700"
        fill={color} fontFamily="monospace">
        {label}
      </text>
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSwap() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="7 23 3 19 7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

/**
 * Shown when a song already has a beat attached.
 * Provides play, download, open folder, and replace (detach) actions.
 *
 * Props:
 *   beat        — beat record
 *   showToast   — (msg, type) => void
 *   onDetach    — () => void  — called when beat is successfully detached
 *   onPlay      — () => void  — called to play this beat in the music player
 */
export default function BeatCard({ beat, showToast, onDetach, onPlay }) {
  const [copied,       setCopied]       = useState(false);
  const [detaching,    setDetaching]    = useState(false);
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);

  const hostPath = beat.hostRelativeFilePath || "./downloads/" + beat.file_name;
  const size     = formatBytes(beat.file_size_bytes);
  const streamUrl = getBeatStreamUrl(beat.id);

  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(hostPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Clipboard unavailable.", "warning");
    }
  }

  async function handleOpenFolder() {
    setOpeningFolder(true);
    try {
      const result = await openBeatFolder(beat.id);
      if (!result.success) {
        // Show the path so the user can navigate there manually
        showToast(result.message || `Find your beat at: ${hostPath}`, "info");
      } else {
        showToast("Folder opened!", "success");
      }
    } catch (err) {
      showToast(err.message || "Could not open folder.", "error");
    } finally {
      setOpeningFolder(false);
    }
  }

  async function handleDetach() {
    if (!confirmDetach) {
      setConfirmDetach(true);
      return;
    }
    setDetaching(true);
    try {
      await detachBeat(beat.id);
      showToast("Beat detached. You can now attach a new one.", "success");
      onDetach?.();
    } catch (err) {
      showToast(err.message || "Could not detach beat.", "error");
    } finally {
      setDetaching(false);
      setConfirmDetach(false);
    }
  }

  return (
    <div className="beat-card">
      {/* Success header */}
      <div className="beat-card__header">
        <SvgCheckmark size={36} />
        <div>
          <p className="beat-card__label">Beat attached</p>
          <p className="beat-card__source">
            {beat.youtube_url ? (
              <a href={beat.youtube_url} target="_blank" rel="noreferrer">
                YouTube source ↗
              </a>
            ) : "Local file"}
          </p>
        </div>
      </div>

      {/* File info chip */}
      <div className="beat-card__file">
        <span className="beat-card__wav-icon" aria-hidden="true">
          <AudioFormatIcon ext={beat.file_extension || "wav"} />
        </span>
        <div className="beat-card__file-info">
          <span className="beat-card__filename" title={beat.file_name}>
            {beat.file_name}
          </span>
          {size && <span className="beat-card__size">{size}</span>}
        </div>
      </div>

      {/* Host path */}
      <div className="beat-card__path-row">
        <span className="beat-card__path-label">Path</span>
        <code className="beat-card__path" title={hostPath}>{hostPath}</code>
      </div>

      {/* Actions */}
      <div className="beat-card__actions">
        {/* Play in music player */}
        {onPlay && (
          <button className="btn btn--grad btn--sm" onClick={onPlay} title="Play this beat">
            <IconPlay /> Play
          </button>
        )}

        <a
          className="btn btn--accent btn--sm"
          href={getBeatDownloadUrl(beat.id)}
          download={beat.file_name}
          title="Download WAV"
        >
          ⬇ Download
        </a>

        <button
          className="btn btn--ghost btn--sm"
          onClick={handleCopyPath}
          title="Copy file path"
        >
          {copied ? "✓ Copied!" : "📋 Copy Path"}
        </button>

        <button
          className={`btn btn--ghost btn--sm${openingFolder ? " btn--loading" : ""}`}
          onClick={handleOpenFolder}
          disabled={openingFolder}
          title="Open containing folder"
        >
          {openingFolder
            ? <><span className="spinner" /> Opening…</>
            : <><IconFolder /> Open Folder</>
          }
        </button>
      </div>

      {/* Replace / detach beat */}
      <div className="beat-card__replace-row">
        {confirmDetach ? (
          <div className="beat-card__confirm-detach">
            <span className="beat-card__confirm-text">Remove this beat?</span>
            <button
              className={`btn btn--danger btn--sm${detaching ? " btn--loading" : ""}`}
              onClick={handleDetach}
              disabled={detaching}
            >
              {detaching ? <><span className="spinner" /> Removing…</> : "Yes, remove"}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirmDetach(false)}
              disabled={detaching}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="beat-card__replace-btn"
            onClick={handleDetach}
            title="Detach this beat and attach a different one"
          >
            <IconSwap /> Change beat
          </button>
        )}
      </div>
    </div>
  );
}
