import React, { useState } from "react";
import { getAlbumCoverUrl } from "../api.js";

// Fallback gradients for albums without cover art
const GRADIENTS = [
  "linear-gradient(135deg, #E8003A 0%, #FF6040 100%)",
  "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)",
  "linear-gradient(135deg, #065F46 0%, #059669 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #92400E 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #1F2937 0%, #4B5563 100%)",
];

function StatusPips({ finished, inProgress, draft }) {
  const total = (finished || 0) + (inProgress || 0) + (draft || 0);
  if (!total) return null;
  return (
    <div className="album-card__pips">
      {Array.from({ length: Math.min(total, 8) }).map((_, i) => {
        let color = "#64748b"; // draft
        if (i < (finished || 0)) color = "#4ade80";
        else if (i < (finished || 0) + (inProgress || 0)) color = "#60a5fa";
        return (
          <span
            key={i}
            className="album-card__pip"
            style={{ background: color }}
          />
        );
      })}
      {total > 8 && <span className="album-card__pip-more">+{total - 8}</span>}
    </div>
  );
}

function IconPin({ pinned }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="17" x2="12" y2="22"/>
      <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z"/>
    </svg>
  );
}

function AlbumColorDot({ albumId, color, onChange }) {
  const ref = React.useRef(null);
  return (
    <span
      className="album-color-dot"
      style={{ background: color }}
      title="Click to change album color"
      onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
    >
      <input
        ref={ref}
        type="color"
        value={color}
        onChange={(e) => onChange(String(albumId), e.target.value)}
        aria-hidden="true"
      />
    </span>
  );
}

/**
 * Album card shown in the library grid.
 *
 * Props:
 *   album          — album record
 *   onClick        — () => void
 *   onDelete       — () => void  (optional)
 *   isPinned       — boolean (optional)
 *   onTogglePin    — () => void  (optional)
 *   albumColor     — string | undefined (hex color)
 *   onSetAlbumColor — (id, hex) => void  (optional)
 */
export default function AlbumCard({ album, onClick, onDelete, isPinned, onTogglePin, albumColor, onSetAlbumColor }) {
  const [imgError, setImgError] = useState(false);
  const [coverTs,  setCoverTs]  = useState("");

  const gradient  = GRADIENTS[album.id % GRADIENTS.length];
  const hasCover  = album.cover_art_path && !imgError;
  const coverUrl  = getAlbumCoverUrl(album.id, coverTs);
  const songCount = Number(album.song_count) || 0;

  return (
    <div
      className="album-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Cover art */}
      <div
        className="album-card__cover"
        style={!hasCover ? { background: gradient } : undefined}
      >
        {hasCover && (
          <img
            src={coverUrl}
            alt={album.name}
            className="album-card__cover-img"
            onError={() => setImgError(true)}
          />
        )}

        {/* Music note placeholder when no cover */}
        {!hasCover && (
          <svg className="album-card__cover-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.6)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6"  cy="18" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
            <circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
          </svg>
        )}

        {/* Song count chip */}
        <span className="album-card__count-chip">
          {songCount} {songCount === 1 ? "song" : "songs"}
        </span>

        {/* Pin button (shows on hover or when pinned) */}
        {onTogglePin && (
          <button
            className={`album-card__pin${isPinned ? " album-card__pin--pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            title={isPinned ? "Unpin album" : "Pin to sidebar"}
            aria-label={isPinned ? `Unpin "${album.name}"` : `Pin "${album.name}"`}
          >
            <IconPin pinned={isPinned} />
          </button>
        )}
      </div>

      {/* Color accent strip */}
      {albumColor && (
        <div className="album-card__color-strip" style={{ background: albumColor }} />
      )}

      {/* Info */}
      <div className="album-card__info">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onSetAlbumColor && (
            <AlbumColorDot albumId={album.id} color={albumColor || "#94a3b8"} onChange={onSetAlbumColor} />
          )}
          <p className="album-card__name" title={album.name} style={{ flex: 1, margin: 0 }}>{album.name}</p>
        </div>
        {album.description && (
          <p className="album-card__desc" title={album.description}>{album.description}</p>
        )}

        <StatusPips
          finished={album.finished_count}
          inProgress={album.in_progress_count}
          draft={album.draft_count}
        />
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          className="album-card__delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete album"
          aria-label={`Delete album "${album.name}"`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
