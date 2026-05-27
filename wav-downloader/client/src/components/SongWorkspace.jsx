import React, { useEffect, useRef, useState } from "react";
import { updateSong }        from "../api.js";
import { getBeatStreamUrl, getCompletedSongStreamUrl } from "../api.js";
import LyricsEditor          from "./LyricsEditor.jsx";
import BeatDownloader        from "./BeatDownloader.jsx";
import BeatCard              from "./BeatCard.jsx";
import ActivityTimeline      from "./ActivityTimeline.jsx";
import CompletedSongPanel    from "./CompletedSongPanel.jsx";
import SongAlbumsPanel       from "./SongAlbumsPanel.jsx";

const STATUS_OPTIONS = ["draft", "in_progress", "finished"];

// ── BandLab link sub-component ────────────────────────────────────────────────

const BL_PATTERN = /^https?:\/\/(www\.)?bandlab\.com\//i;

function BandLabLink({ songId, initial, onPatch, showToast }) {
  const [editing, setEditing] = useState(!initial);
  const [draft,   setDraft]   = useState(initial || "");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    setDraft(initial || "");
    setEditing(!initial);
  }, [songId, initial]);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed && !BL_PATTERN.test(trimmed)) {
      showToast("Please enter a valid BandLab URL (bandlab.com/…)", "error");
      return;
    }
    setSaving(true);
    try {
      await updateSong(songId, { bandlab_url: trimmed || null });
      onPatch({ bandlab_url: trimmed || null });
      setEditing(false);
      showToast(trimmed ? "BandLab link saved." : "BandLab link removed.", "success");
    } catch {
      showToast("Could not save link.", "error");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(initial || "");
    setEditing(false);
  }

  return (
    <div className="bl-link-panel">
      <div className="bl-link-panel__head">
        <span className="bl-link-panel__badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="#E8003A" />
            <path d="M8 16V8h5a3 3 0 010 6H8" stroke="#fff" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          BandLab
        </span>
        <span className="bl-link-panel__label">Project Link</span>
        {!editing && initial && (
          <button className="bl-link-panel__edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="bl-link-panel__input-row">
          <div className="url-field bl-link-panel__url-field">
            <span className="url-field__icon" style={{ fontSize: "0.85rem" }}>🔗</span>
            <input
              type="url"
              className="url-field__input"
              placeholder="https://www.bandlab.com/your-project"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  save();
                if (e.key === "Escape") cancel();
              }}
              spellCheck={false}
            />
          </div>
          <div className="bl-link-panel__actions">
            <button
              className={`btn btn--grad btn--sm${saving ? " btn--loading" : ""}`}
              onClick={save}
              disabled={saving}
            >
              {saving ? <><span className="spinner" />Saving…</> : "Save"}
            </button>
            {initial && (
              <button className="btn btn--ghost btn--sm" onClick={cancel} disabled={saving}>
                Cancel
              </button>
            )}
            {initial && (
              <button
                className="btn btn--danger btn--sm"
                onClick={() => { setDraft(""); save(); }}
                disabled={saving}
                title="Remove link"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <a
          href={initial}
          target="_blank"
          rel="noopener noreferrer"
          className="bl-link-panel__link"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round"/>
          </svg>
          {initial.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      )}
    </div>
  );
}

// ── Main workspace ────────────────────────────────────────────────────────────

const STATUS_DOT_COLORS = { draft: "#94a3b8", in_progress: "#60a5fa", finished: "#4ade80" };

export default function SongWorkspace({ song, loading, onRefresh, onPatchSong, showToast, onExport, onPlayTrack, songColors, onSetSongColor }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState("");
  // Beat "replacing" state — when detached, show downloader
  const [beatDetached, setBeatDetached] = useState(false);
  const colorInputRef = useRef(null);

  // Reset detach state when song changes (player reset is handled by App.jsx)
  useEffect(() => {
    setBeatDetached(false);
  }, [song?.id]);

  if (loading) {
    return (
      <div className="workspace workspace--loading">
        <div className="workspace__spinner" />
        <p>Loading song…</p>
      </div>
    );
  }

  if (!song) return null;

  const latestBeat = !beatDetached && Array.isArray(song.beats) && song.beats.length > 0
    ? song.beats[0]
    : null;

  const primaryCompletedSong = Array.isArray(song.completed_songs) && song.completed_songs.length > 0
    ? (song.completed_songs.find((cs) => cs.is_primary) || song.completed_songs[0])
    : null;

  async function handleTitleSave() {
    if (!titleDraft.trim()) { setEditingTitle(false); return; }
    try {
      await updateSong(song.id, { title: titleDraft.trim() });
      onPatchSong({ title: titleDraft.trim() });
    } catch {
      showToast("Could not save title.", "error");
    }
    setEditingTitle(false);
  }

  async function handleStatusChange(e) {
    const status = e.target.value;
    try {
      await updateSong(song.id, { status });
      onPatchSong({ status });
      showToast(`Status → ${status}`, "success");
    } catch {
      showToast("Could not update status.", "error");
    }
  }

  function handleBeatReady() {
    setBeatDetached(false);
    onRefresh();
  }

  function handleBeatDetach() {
    setBeatDetached(true);
    onRefresh();
  }

  function playBeat(beat) {
    onPlayTrack?.({
      url:  getBeatStreamUrl(beat.id),
      name: beat.original_video_title || beat.file_name || "Beat",
      type: "beat",
    });
  }

  function playCompletedSong(cs) {
    onPlayTrack?.({
      url:  getCompletedSongStreamUrl(cs.id),
      name: cs.version_label || cs.original_file_name || "Mix",
      type: "mix",
    });
  }

  return (
    <div className="workspace">
      {/* ── Song Header ──────────────────────────────────────────────────────── */}
      <header className="workspace__header">
        <div className="workspace__title-row">
          {/* Color swatch */}
          {onSetSongColor && (() => {
            const dotColor = songColors?.[String(song.id)] || STATUS_DOT_COLORS[song.status] || STATUS_DOT_COLORS.draft;
            return (
              <span
                className="workspace__color-swatch"
                style={{ background: dotColor }}
                title="Click to change song color"
                onClick={() => colorInputRef.current?.click()}
              >
                <input
                  ref={colorInputRef}
                  type="color"
                  value={dotColor}
                  onChange={(e) => onSetSongColor(String(song.id), e.target.value)}
                  aria-hidden="true"
                />
              </span>
            );
          })()}

          {editingTitle ? (
            <input
              className="workspace__title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <h1
              className="workspace__title"
              onClick={() => { setTitleDraft(song.title); setEditingTitle(true); }}
              title="Click to edit title"
            >
              {song.title}
            </h1>
          )}

          <select
            className="status-select"
            value={song.status || "draft"}
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>

          {onExport && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => onExport(song.id)}
              title="Export song"
            >
              ↗ Export
            </button>
          )}
        </div>

        <div className="workspace__meta">
          {song.artist_name   && <span className="meta-chip">🎤 {song.artist_name}</span>}
          {song.mood          && <span className="meta-chip">🎭 {song.mood}</span>}
          {song.bpm           && <span className="meta-chip">⚡ {song.bpm} BPM</span>}
          {song.key_signature && <span className="meta-chip">🎹 {song.key_signature}</span>}
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────────── */}
      <div className="workspace__body">
        {/* Left: Lyrics editor */}
        <section className="workspace__lyrics-col">
          <LyricsEditor
            song={song}
            onPatch={onPatchSong}
            showToast={showToast}
          />
        </section>

        {/* Right: Beat panel + BandLab + Completed Song + Activity */}
        <aside className="workspace__beat-col">

          {/* BandLab project link */}
          <BandLabLink
            songId={song.id}
            initial={song.bandlab_url || null}
            onPatch={onPatchSong}
            showToast={showToast}
          />

          <div className="beat-panel">
            <h3 className="beat-panel__title">
              {latestBeat ? "Your Beat" : "Beat"}
            </h3>

            {latestBeat ? (
              <BeatCard
                beat={latestBeat}
                showToast={showToast}
                onDetach={handleBeatDetach}
                onPlay={() => playBeat(latestBeat)}
              />
            ) : (
              <BeatDownloader
                songId={song.id}
                onBeatReady={handleBeatReady}
                showToast={showToast}
              />
            )}
          </div>

          {/* Completed Song upload panel */}
          <CompletedSongPanel
            song={song}
            onRefresh={onRefresh}
            showToast={showToast}
            onPlaySong={playCompletedSong}
          />

          {/* Albums panel — add/remove this song from albums */}
          <SongAlbumsPanel
            songId={song.id}
            showToast={showToast}
          />

          {/* Activity timeline */}
          <ActivityTimeline activity={song.activity || []} />
        </aside>
      </div>

    </div>
  );
}
