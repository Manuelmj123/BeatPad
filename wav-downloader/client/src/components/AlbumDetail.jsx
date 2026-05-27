import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAlbum, updateAlbum, deleteAlbum,
  removeSongFromAlbum, uploadAlbumCover,
  getAlbumCoverUrl,
} from "../api.js";
import AddSongsToAlbumModal from "./AddSongsToAlbumModal.jsx";

// ── Gradient fallbacks ────────────────────────────────────────────────────────
const GRADIENTS = [
  "linear-gradient(135deg, #E8003A 0%, #FF6040 100%)",
  "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)",
  "linear-gradient(135deg, #065F46 0%, #059669 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #92400E 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #1F2937 0%, #4B5563 100%)",
];

const STATUS_COLORS  = { draft: "#64748b", in_progress: "#60a5fa", finished: "#4ade80" };
const STATUS_LABELS  = { draft: "Draft", in_progress: "In Progress", finished: "Finished" };

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
      <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * Detail view for a single album.
 *
 * Props:
 *   albumId       — number
 *   onBack        — () => void — navigate back to library
 *   onSelectSong  — (songId) => void
 *   onCreateSong  — (albumId) => void — create a new song and add to this album
 *   showToast
 */
export default function AlbumDetail({ albumId, onBack, onSelectSong, onCreateSong, showToast, albumColor, onSetAlbumColor }) {
  const [album,       setAlbum]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState("");
  const [savingName,  setSavingName]  = useState(false);
  const [imgError,    setImgError]    = useState(false);
  const [coverTs,     setCoverTs]     = useState("");
  const [showAddSongs,setShowAddSongs]= useState(false);
  const [removingId,  setRemovingId]  = useState(null);
  const coverInputRef    = useRef(null);
  const albumColorRef    = useRef(null);

  const load = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    try {
      const { album: a } = await fetchAlbum(albumId);
      setAlbum(a);
      setNameDraft(a.name);
      setImgError(false);
    } catch {
      showToast("Could not load album.", "error");
    } finally {
      setLoading(false);
    }
  }, [albumId, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveName() {
    if (!nameDraft.trim() || nameDraft === album.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const { album: updated } = await updateAlbum(albumId, { name: nameDraft.trim() });
      setAlbum(updated);
      setEditingName(false);
      showToast("Album renamed.", "success");
    } catch (err) {
      showToast(err.message || "Could not rename.", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAlbumCover(albumId, file);
      setImgError(false);
      setCoverTs(Date.now().toString()); // bust cache
      showToast("Cover art updated!", "success");
    } catch (err) {
      showToast(err.message || "Cover upload failed.", "error");
    }
  }

  async function handleRemoveSong(songId, songTitle) {
    if (!window.confirm(`Remove "${songTitle}" from this album? The song is kept.`)) return;
    setRemovingId(songId);
    try {
      await removeSongFromAlbum(albumId, songId);
      showToast("Song removed from album.", "info");
      load();
    } catch (err) {
      showToast(err.message || "Could not remove song.", "error");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeleteAlbum() {
    if (!window.confirm(`Delete album "${album.name}"? All songs are kept.`)) return;
    try {
      await deleteAlbum(albumId);
      showToast("Album deleted.", "info");
      onBack();
    } catch (err) {
      showToast(err.message || "Could not delete album.", "error");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="album-detail album-detail--loading">
        <div className="workspace__spinner" />
        <p>Loading album…</p>
      </div>
    );
  }

  if (!album) return null;

  const songs    = album.songs ?? [];
  const gradient = GRADIENTS[albumId % GRADIENTS.length];
  const hasCover = album.cover_art_path && !imgError;
  const coverUrl = getAlbumCoverUrl(albumId, coverTs);

  const currentSongIds = new Set(songs.map((s) => s.id));
  const finished    = songs.filter((s) => s.status === "finished").length;
  const inProgress  = songs.filter((s) => s.status === "in_progress").length;
  const draft       = songs.filter((s) => s.status === "draft").length;

  return (
    <div className="album-detail">

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <div className="album-detail__hero" style={{ background: hasCover ? undefined : gradient }}>
        {/* Back button */}
        <button className="album-detail__back" onClick={onBack}>
          <IconBack /> Library
        </button>

        {/* Cover art */}
        <div className="album-detail__cover-wrap">
          <div className="album-detail__cover" style={!hasCover ? { background: "rgba(0,0,0,0.2)" } : undefined}>
            {hasCover ? (
              <img
                src={coverUrl}
                alt={album.name}
                className="album-detail__cover-img"
                onError={() => setImgError(true)}
              />
            ) : (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6"  cy="18" r="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                <circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              </svg>
            )}

            {/* Hover: change cover */}
            <button
              className="album-detail__cover-btn"
              onClick={() => coverInputRef.current?.click()}
              title="Change cover art"
              aria-label="Change cover art"
            >
              <IconImage /> Change cover
            </button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleCoverUpload}
          />
        </div>

        {/* Album info */}
        <div className="album-detail__info">
          {editingName ? (
            <div className="album-detail__name-edit">
              <input
                className="album-detail__name-input"
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              {savingName && <span className="spinner" />}
            </div>
          ) : (
            <h1
              className="album-detail__name"
              onClick={() => { setNameDraft(album.name); setEditingName(true); }}
              title="Click to rename"
            >
              {album.name}
              <span className="album-detail__edit-hint"><IconEdit /></span>
            </h1>
          )}

          {album.description && (
            <p className="album-detail__desc">{album.description}</p>
          )}

          <div className="album-detail__meta">
            <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
            {finished > 0    && <span style={{ color: "#4ade80" }}>· {finished} finished</span>}
            {inProgress > 0  && <span style={{ color: "#60a5fa" }}>· {inProgress} in progress</span>}
            {draft > 0       && <span style={{ color: "#94a3b8" }}>· {draft} draft</span>}
          </div>

          {/* Album color picker */}
          {onSetAlbumColor && (
            <div className="album-detail__color-wrap">
              <span className="album-detail__color-label">Color</span>
              <span
                className="album-detail__color-dot"
                style={{ background: albumColor || "#94a3b8" }}
                title="Click to change album color"
                onClick={() => albumColorRef.current?.click()}
              >
                <input
                  ref={albumColorRef}
                  type="color"
                  value={albumColor || "#94a3b8"}
                  onChange={(e) => onSetAlbumColor(String(albumId), e.target.value)}
                  aria-hidden="true"
                />
              </span>
            </div>
          )}
        </div>

        {/* Hero actions */}
        <div className="album-detail__hero-actions">
          <button
            className="btn btn--danger btn--sm"
            onClick={handleDeleteAlbum}
            title="Delete album"
          >
            Delete Album
          </button>
        </div>
      </div>

      {/* ── Songs list ──────────────────────────────────────────────────────── */}
      <div className="album-detail__body">
        <div className="album-detail__songs-header">
          <h2 className="album-detail__songs-title">Songs</h2>
          <div className="album-detail__songs-actions">
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowAddSongs(true)}
            >
              + Add Existing Songs
            </button>
            <button
              className="btn btn--grad btn--sm"
              onClick={() => onCreateSong(albumId)}
            >
              + New Song
            </button>
          </div>
        </div>

        {songs.length === 0 && (
          <div className="album-detail__empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.2">
              <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6"  cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <p>No songs yet. Create one or add existing songs.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setShowAddSongs(true)}>
                + Add Existing
              </button>
              <button className="btn btn--grad btn--sm" onClick={() => onCreateSong(albumId)}>
                + New Song
              </button>
            </div>
          </div>
        )}

        {songs.length > 0 && (
          <div className="album-songs-list">
            {songs.map((song, i) => (
              <div
                key={song.id}
                className="album-song-row"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className="album-song-row__num">{i + 1}</span>

                <span
                  className="album-song-row__dot"
                  title={STATUS_LABELS[song.status]}
                  style={{ background: STATUS_COLORS[song.status] || STATUS_COLORS.draft }}
                />

                <div className="album-song-row__info" onClick={() => onSelectSong(song.id)}>
                  <span className="album-song-row__title">{song.title}</span>
                  {song.artist_name && (
                    <span className="album-song-row__artist">{song.artist_name}</span>
                  )}
                </div>

                <span className="album-song-row__status">
                  {STATUS_LABELS[song.status] || "Draft"}
                </span>

                {song.beat_file_name && (
                  <span className="album-song-row__beat" title="Beat attached">♪</span>
                )}

                <span className="album-song-row__time">{timeAgo(song.updated_at)}</span>

                <button
                  className="btn btn--grad btn--sm album-song-row__open"
                  onClick={() => onSelectSong(song.id)}
                  title="Open song workspace"
                >
                  Open →
                </button>

                <button
                  className={`album-song-row__remove${removingId === song.id ? " btn--loading" : ""}`}
                  onClick={() => handleRemoveSong(song.id, song.title)}
                  disabled={removingId === song.id}
                  title="Remove from album"
                  aria-label={`Remove "${song.title}" from album`}
                >
                  {removingId === song.id ? <span className="spinner" /> : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add songs modal ──────────────────────────────────────────────────── */}
      {showAddSongs && (
        <AddSongsToAlbumModal
          albumId={albumId}
          albumName={album.name}
          currentSongIds={currentSongIds}
          onClose={() => setShowAddSongs(false)}
          onSuccess={() => { setShowAddSongs(false); load(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
