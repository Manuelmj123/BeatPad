import React, { useState } from "react";
import {
  updateCompletedSong,
  deleteCompletedSong,
  getCompletedSongDownloadUrl,
  getCompletedSongStreamUrl,
  openCompletedSongFolder,
} from "../api.js";

function IconFolder() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

/**
 * Card for a single completed song record.
 *
 * Props:
 *   completedSong — record from API
 *   onRefresh     — () => void
 *   showToast     — (msg, type) => void
 *   compact       — bool (smaller layout for secondary versions)
 *   onPlay        — (cs) => void — play this song in the music player
 */
export default function CompletedSongCard({ completedSong, onRefresh, showToast, compact = false, onPlay }) {
  const [editing,       setEditing]       = useState(false);
  const [labelDraft,    setLabelDraft]    = useState(completedSong.version_label || "");
  const [notesDraft,    setNotesDraft]    = useState(completedSong.notes || "");
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDel,    setConfirmDel]    = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);

  const streamUrl   = getCompletedSongStreamUrl(completedSong.id);
  const downloadUrl = getCompletedSongDownloadUrl(completedSong.id);

  function formatBytes(bytes) {
    if (!bytes) return null;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formatDate(str) {
    if (!str) return null;
    try {
      return new Date(str).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch { return str; }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateCompletedSong(completedSong.id, {
        versionLabel: labelDraft.trim() || null,
        notes:        notesDraft.trim() || null,
      });
      onRefresh();
      setEditing(false);
      showToast("Updated.", "success");
    } catch (err) {
      showToast(err.message || "Could not update.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPrimary() {
    try {
      await updateCompletedSong(completedSong.id, { isPrimary: true });
      onRefresh();
      showToast("Set as primary version.", "success");
    } catch (err) {
      showToast(err.message || "Could not update.", "error");
    }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await deleteCompletedSong(completedSong.id);
      onRefresh();
      showToast("Deleted.", "info");
    } catch (err) {
      showToast(err.message || "Could not delete.", "error");
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  async function handleOpenFolder() {
    setOpeningFolder(true);
    try {
      const result = await openCompletedSongFolder(completedSong.id);
      if (!result.success) {
        showToast(result.message || `Find your file at: ${completedSong.hostRelativeFilePath}`, "info");
      } else {
        showToast("Folder opened!", "success");
      }
    } catch (err) {
      showToast(err.message || "Could not open folder.", "error");
    } finally {
      setOpeningFolder(false);
    }
  }

  const sizeLabel = formatBytes(completedSong.file_size_bytes);
  const dateLabel = formatDate(completedSong.created_at);

  return (
    <div className={`cs-card${compact ? " cs-card--compact" : ""}${completedSong.is_primary ? " cs-card--primary" : ""}`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="cs-card__header">
        <span className="cs-card__file-icon">🎵</span>
        <div className="cs-card__file-info">
          {editing ? (
            <input
              className="field__input cs-card__label-input"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Version label (e.g. Final Mix)"
              autoFocus
            />
          ) : (
            <div className="cs-card__filename" title={completedSong.original_file_name}>
              {completedSong.original_file_name}
            </div>
          )}
          <div className="cs-card__meta-row">
            {completedSong.version_label && !editing && (
              <span className="cs-card__version-badge">{completedSong.version_label}</span>
            )}
            {completedSong.is_primary && (
              <span className="cs-card__primary-badge">★ Primary</span>
            )}
            {sizeLabel && <span className="cs-card__size">{sizeLabel}</span>}
            {dateLabel && <span className="cs-card__date">{dateLabel}</span>}
          </div>
        </div>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {editing ? (
        <textarea
          className="field__input cs-card__notes-input"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Notes about this recording…"
          rows={2}
        />
      ) : (
        completedSong.notes && (
          <p className="cs-card__notes" title={completedSong.notes}>
            {completedSong.notes}
          </p>
        )
      )}

      {/* ── Audio player ──────────────────────────────────────────────────── */}
      {!compact && (
        <div className="cs-card__audio">
          <audio
            controls
            src={streamUrl}
            preload="none"
            style={{ width: "100%" }}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="cs-card__actions">
        {editing ? (
          <>
            <button
              className="btn btn--accent btn--sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : null}
              Save
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setEditing(false);
                setLabelDraft(completedSong.version_label || "");
                setNotesDraft(completedSong.notes || "");
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {/* Play in music player */}
            {onPlay && (
              <button
                className="btn btn--grad btn--sm"
                onClick={() => onPlay(completedSong)}
                title="Play this song"
              >
                <IconPlay /> Play
              </button>
            )}

            <a
              className="btn btn--secondary btn--sm"
              href={downloadUrl}
              download={completedSong.original_file_name}
              title="Download file"
            >
              ↓ Download
            </a>

            {/* Open folder */}
            <button
              className={`btn btn--ghost btn--sm${openingFolder ? " btn--loading" : ""}`}
              onClick={handleOpenFolder}
              disabled={openingFolder}
              title="Open containing folder"
            >
              {openingFolder
                ? <><span className="spinner" /></>
                : <><IconFolder /> Folder</>
              }
            </button>

            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setEditing(true)}
              title="Edit label / notes"
            >
              ✎ Edit
            </button>

            {!completedSong.is_primary && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={handleSetPrimary}
                title="Set as primary version"
              >
                ★
              </button>
            )}

            <button
              className={`btn btn--sm ${confirmDel ? "btn--danger" : "btn--ghost"}`}
              onClick={handleDelete}
              disabled={deleting}
              title={confirmDel ? "Click again to confirm delete" : "Delete"}
            >
              {deleting ? <span className="spinner" /> : confirmDel ? "Confirm?" : "✕"}
            </button>
          </>
        )}
      </div>

      {confirmDel && !deleting && (
        <button
          className="cs-card__cancel-del"
          onClick={() => setConfirmDel(false)}
        >
          Cancel delete
        </button>
      )}
    </div>
  );
}
