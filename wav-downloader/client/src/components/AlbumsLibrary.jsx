import React, { useCallback, useEffect, useState } from "react";
import { fetchAlbums, fetchUnassignedSongs, deleteAlbum } from "../api.js";
import AlbumCard        from "./AlbumCard.jsx";
import CreateAlbumModal from "./CreateAlbumModal.jsx";

const STATUS_COLORS = {
  draft:       "#64748b",
  in_progress: "#60a5fa",
  finished:    "#4ade80",
};
const STATUS_LABELS = {
  draft:       "Draft",
  in_progress: "In Progress",
  finished:    "Finished",
};

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

function StatsBar({ albums, unassigned }) {
  const totalSongs   = albums.reduce((n, a) => n + Number(a.song_count || 0), 0) + unassigned.length;
  const totalAlbums  = albums.length;
  const totalFinished = albums.reduce((n, a) => n + Number(a.finished_count || 0), 0) +
    unassigned.filter((s) => s.status === "finished").length;

  return (
    <div className="library-stats">
      <div className="library-stats__item">
        <span className="library-stats__num">{totalAlbums}</span>
        <span className="library-stats__label">Album{totalAlbums !== 1 ? "s" : ""}</span>
      </div>
      <div className="library-stats__sep" aria-hidden="true" />
      <div className="library-stats__item">
        <span className="library-stats__num">{totalSongs}</span>
        <span className="library-stats__label">Total Songs</span>
      </div>
      <div className="library-stats__sep" aria-hidden="true" />
      <div className="library-stats__item">
        <span className="library-stats__num" style={{ color: "#4ade80" }}>{totalFinished}</span>
        <span className="library-stats__label">Finished</span>
      </div>
    </div>
  );
}

/**
 * Main library / home view.
 *
 * Props:
 *   onSelectAlbum    — (albumId) => void
 *   onSelectSong     — (songId) => void
 *   showToast
 *   pinnedAlbums     — [{id, name}]  (optional)
 *   onTogglePinAlbum — (album) => void  (optional)
 */
export default function AlbumsLibrary({ onSelectAlbum, onSelectSong, showToast, pinnedAlbums, onTogglePinAlbum, albumColors, onSetAlbumColor }) {
  const [albums,     setAlbums]     = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [albumsRes, unRes] = await Promise.all([fetchAlbums(), fetchUnassignedSongs()]);
      setAlbums(albumsRes.albums ?? []);
      setUnassigned(unRes.songs ?? []);
    } catch {
      showToast("Could not load library.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteAlbum(album) {
    if (!window.confirm(`Delete album "${album.name}"? Songs are kept.`)) return;
    try {
      await deleteAlbum(album.id);
      showToast(`Album "${album.name}" deleted.`, "info");
      load();
    } catch (err) {
      showToast(err.message || "Could not delete album.", "error");
    }
  }

  function handleAlbumCreated(album) {
    setShowCreate(false);
    load();
    onSelectAlbum(album.id);
  }

  if (loading) {
    return (
      <div className="library library--loading">
        <div className="library__spinner">
          <svg viewBox="0 0 50 50" fill="none" width="48" height="48">
            <circle cx="25" cy="25" r="20" stroke="rgba(232,0,58,0.15)" strokeWidth="4"/>
            <circle cx="25" cy="25" r="20" stroke="url(#libGrad)" strokeWidth="4"
              strokeLinecap="round" strokeDasharray="80 45" className="beat-dl__arc"/>
            <defs>
              <linearGradient id="libGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E8003A"/>
                <stop offset="100%" stopColor="#FF6040"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <p className="library__loading-text">Loading your library…</p>
      </div>
    );
  }

  const hasContent = albums.length > 0 || unassigned.length > 0;

  return (
    <div className="library">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="library__header">
        <div className="library__title-row">
          <div className="library__title-group">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="library__heading">Your Music Library</h1>
          </div>
          <button
            className="btn btn--grad library__new-album-btn"
            onClick={() => setShowCreate(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Album
          </button>
        </div>

        {hasContent && <StatsBar albums={albums} unassigned={unassigned} />}
      </header>

      {/* Empty state */}
      {!hasContent && (
        <div className="library__empty">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" opacity="0.18" aria-hidden="true">
            <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6"  cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <h2 className="library__empty-title">Start Your Library</h2>
          <p className="library__empty-sub">
            Create albums to organise your songs, or just start writing.
          </p>
          <button className="btn btn--grad" onClick={() => setShowCreate(true)}>
            + Create Your First Album
          </button>
        </div>
      )}

      {/* ── Albums grid ────────────────────────────────────────────────────── */}
      {albums.length > 0 && (
        <section className="library__section">
          <h2 className="library__section-title">Albums</h2>
          <div className="album-grid">
            {albums.map((album, i) => (
              <div
                key={album.id}
                className="album-grid__cell"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <AlbumCard
                  album={album}
                  onClick={() => onSelectAlbum(album.id)}
                  onDelete={() => handleDeleteAlbum(album)}
                  isPinned={pinnedAlbums?.some((a) => a.id === album.id)}
                  onTogglePin={onTogglePinAlbum ? () => onTogglePinAlbum({ id: album.id, name: album.name }) : undefined}
                  albumColor={albumColors?.[String(album.id)]}
                  onSetAlbumColor={onSetAlbumColor}
                />
              </div>
            ))}

            {/* "New Album" card */}
            <div className="album-grid__cell" style={{ animationDelay: `${albums.length * 60}ms` }}>
              <button
                className="album-card album-card--new"
                onClick={() => setShowCreate(true)}
                aria-label="Create new album"
              >
                <div className="album-card__cover album-card__cover--new">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="album-card__info">
                  <p className="album-card__name">New Album</p>
                </div>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Unsorted songs ──────────────────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <section className="library__section">
          <h2 className="library__section-title">
            Unsorted Songs
            <span className="library__section-count">{unassigned.length}</span>
          </h2>

          <div className="unsorted-list">
            {unassigned.map((song, i) => (
              <div
                key={song.id}
                className="unsorted-row"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => onSelectSong(song.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelectSong(song.id)}
              >
                <span
                  className="unsorted-row__dot"
                  style={{ background: STATUS_COLORS[song.status] || STATUS_COLORS.draft }}
                />
                <span className="unsorted-row__title">{song.title}</span>
                {song.artist_name && (
                  <span className="unsorted-row__artist">{song.artist_name}</span>
                )}
                <span className="unsorted-row__status">
                  {STATUS_LABELS[song.status] || "Draft"}
                </span>
                {song.beat_file_name && (
                  <span className="unsorted-row__beat" title="Has beat attached">♪</span>
                )}
                <span className="unsorted-row__time">{timeAgo(song.updated_at)}</span>
                <span className="unsorted-row__arrow">→</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Create album modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreate={handleAlbumCreated}
          showToast={showToast}
        />
      )}
    </div>
  );
}
