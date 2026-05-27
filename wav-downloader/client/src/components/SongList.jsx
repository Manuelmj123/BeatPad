import React, { useRef } from "react";

const STATUS_COLORS = {
  draft:       "#94a3b8",
  in_progress: "#60a5fa",
  finished:    "#4ade80",
};

const BADGE_LABELS = {
  lyrics:    "Lyrics",
  beat:      "Beat",
  project:   "Project",
  completed: "Completed",
  notes:     "Notes",
  artist:    "Artist",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

/**
 * Clickable color dot — opens the native color picker on click.
 */
function ColorDot({ songId, color, onChange }) {
  const inputRef = useRef(null);

  return (
    <span
      className="song-card__color-dot"
      style={{ background: color }}
      title="Click to change song color"
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        type="color"
        value={color}
        className="song-card__color-input"
        onChange={(e) => onChange(String(songId), e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  );
}

/**
 * Highlight `terms` inside `text` by wrapping matches in <mark> elements.
 * Uses a capturing-group split so even indices are plain text, odd are matches.
 */
function HighlightedText({ text, terms }) {
  if (!text || !terms || terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts   = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="search-hl">{part}</mark>
          : part
      )}
    </>
  );
}

/**
 * Song list with smart search result display, pin and per-song color support.
 *
 * Props:
 *   songs          — array of song records
 *   selectedId     — currently selected song id
 *   onSelect       — (id) => void
 *   onDelete       — (id) => void
 *   pinnedSongIds  — Set<string>  (optional)
 *   onTogglePin    — (id) => void  (optional)
 *   songColors     — { [id]: string }  (optional)
 *   onSetColor     — (id, hex) => void  (optional)
 *   searchTerms    — string[]  (optional) — active search tokens for highlighting
 *   matchInfoMap   — { [songId]: matchDetail[] }  (optional)
 */
export default function SongList({
  songs,
  selectedId,
  onSelect,
  onDelete,
  pinnedSongIds,
  onTogglePin,
  songColors,
  onSetColor,
  searchTerms,
  matchInfoMap,
}) {
  if (songs.length === 0) {
    return (
      <div className="song-list__empty">
        No songs yet
      </div>
    );
  }

  const isSearching = searchTerms && searchTerms.length > 0;

  return (
    <ul className="song-list">
      {songs.map((song) => {
        const isPinned    = pinnedSongIds?.has(String(song.id));
        const dotColor    = songColors?.[String(song.id)]
          || STATUS_COLORS[song.status]
          || STATUS_COLORS.draft;
        const matchDetails = matchInfoMap?.[String(song.id)] || [];
        const lyricsMatch  = matchDetails.find((m) => m.field === "lyrics");
        const otherMatches = matchDetails.filter((m) => m.field !== "lyrics");

        return (
          <li
            key={song.id}
            className={`song-card${song.id === selectedId ? " song-card--active" : ""}${isSearching && matchDetails.length > 0 ? " song-card--matched" : ""}`}
            onClick={() => onSelect(song.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(song.id)}
          >
            {/* Top row: color dot + title + delete btn */}
            <div className="song-card__top">
              {onSetColor ? (
                <ColorDot songId={song.id} color={dotColor} onChange={onSetColor} />
              ) : (
                <span
                  className="song-card__color-dot"
                  style={{ background: dotColor }}
                />
              )}
              <span className="song-card__title">
                {isSearching
                  ? <HighlightedText text={song.title} terms={searchTerms} />
                  : song.title
                }
              </span>
            </div>

            {/* Meta row */}
            <div className="song-card__meta">
              {song.artist_name && (
                <span className="song-card__artist">
                  {isSearching
                    ? <HighlightedText text={song.artist_name} terms={searchTerms} />
                    : song.artist_name
                  }
                </span>
              )}
              {song.beat_file_name && (
                <span className="song-card__beat" title={song.beat_file_name}>
                  🎵 Beat attached
                </span>
              )}
            </div>

            {/* ── Match info — only shown while searching ───────────────── */}
            {isSearching && otherMatches.length > 0 && (
              <div className="song-card__match-row">
                {otherMatches.map(({ field, name }, i) => (
                  <span
                    key={i}
                    className={`match-badge match-badge--${field}`}
                    title={field === "completed" && name ? name : undefined}
                  >
                    {field === "completed" && name
                      ? `✓ ${name.length > 22 ? name.slice(0, 22) + "…" : name}`
                      : BADGE_LABELS[field] ?? field
                    }
                  </span>
                ))}
              </div>
            )}

            {/* Lyrics snippet — only shown when lyrics matched */}
            {isSearching && lyricsMatch?.snippet && (
              <div className="song-card__snippet">
                "<HighlightedText text={lyricsMatch.snippet} terms={searchTerms} />"
              </div>
            )}

            {/* Footer: time + mood + (spacer for pin/delete) */}
            <div className="song-card__footer">
              <span className="song-card__time">{timeAgo(song.updated_at)}</span>
              <div className="song-card__footer-actions">
                {song.mood && <span className="song-card__mood">{song.mood}</span>}

                {onTogglePin && (
                  <button
                    className={`song-card__pin${isPinned ? " song-card__pin--pinned" : ""}`}
                    title={isPinned ? "Unpin" : "Pin to sidebar"}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(String(song.id)); }}
                    aria-label={isPinned ? `Unpin "${song.title}"` : `Pin "${song.title}"`}
                  >
                    <IconPin pinned={isPinned} />
                  </button>
                )}
              </div>
            </div>

            {/* Delete — top-right corner */}
            <button
              className="song-card__delete"
              title="Delete song"
              onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}
              aria-label={`Delete "${song.title}"`}
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
