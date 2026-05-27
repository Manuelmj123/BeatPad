import React, { useState, useMemo, useRef, useEffect } from "react";
import SongList    from "./SongList.jsx";
import SvgWaveform from "./SvgWaveform.jsx";

function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconAlbum() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="3"  stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconSong() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6"  cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Search utilities ───────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract the line from `lyrics` that contains the match at `charIdx`.
 */
function getLyricsSnippet(lyrics, term) {
  if (!lyrics || !term) return null;
  const lower = lyrics.toLowerCase();
  const idx   = lower.indexOf(term.toLowerCase());
  if (idx === -1) return null;
  const lineStart = lyrics.lastIndexOf("\n", idx);
  const lineEnd   = lyrics.indexOf("\n", idx);
  const line = lyrics
    .slice(lineStart < 0 ? 0 : lineStart + 1, lineEnd < 0 ? lyrics.length : lineEnd)
    .trim();
  return line.slice(0, 100) || null;
}

/**
 * Score a single song against a set of search terms.
 * Returns null when not all terms match, otherwise { score, matchDetails }.
 *
 * matchDetails is an array of { field, snippet?, name? } objects for
 * non-title matches that the SongList card should render.
 */
function computeMatch(song, terms) {
  let   score       = 0;
  const seenFields  = new Set();
  const matchDetails = [];
  let   allMatched  = true;

  for (const term of terms) {
    const t   = term.toLowerCase();
    let   hit = false;

    // Title — weight 100
    if ((song.title || "").toLowerCase().includes(t)) {
      score += 100; hit = true;
      seenFields.add("title");
    }

    // Artist — weight 70
    if ((song.artist_name || "").toLowerCase().includes(t)) {
      score += 70; hit = true;
      if (!seenFields.has("artist")) {
        seenFields.add("artist");
        matchDetails.push({ field: "artist" });
      }
    }

    // Completed song file names — weight 65
    if ((song.completed_song_names || "").toLowerCase().includes(t)) {
      score += 65; hit = true;
      if (!seenFields.has("completed")) {
        seenFields.add("completed");
        const names     = (song.completed_song_names || "").split("|||");
        const matchName = names.find((n) => n.toLowerCase().includes(t)) || "";
        matchDetails.push({ field: "completed", name: matchName });
      }
    }

    // Beat file name + YouTube title — weight 60
    const beatStr = `${song.beat_file_name || ""} ${song.beat_title || ""}`.toLowerCase();
    if (beatStr.includes(t)) {
      score += 60; hit = true;
      if (!seenFields.has("beat")) {
        seenFields.add("beat");
        matchDetails.push({ field: "beat" });
      }
    }

    // BandLab / project link — weight 50
    if ((song.bandlab_url || "").toLowerCase().includes(t)) {
      score += 50; hit = true;
      if (!seenFields.has("project")) {
        seenFields.add("project");
        matchDetails.push({ field: "project" });
      }
    }

    // Lyrics — weight 40
    if ((song.lyrics || "").toLowerCase().includes(t)) {
      score += 40; hit = true;
      if (!seenFields.has("lyrics")) {
        seenFields.add("lyrics");
        const snippet = getLyricsSnippet(song.lyrics, term);
        matchDetails.push({ field: "lyrics", snippet });
      }
    }

    // Mood — weight 20 (shown in card already; no separate badge)
    if ((song.mood || "").toLowerCase().includes(t)) {
      score += 20; hit = true;
      seenFields.add("mood");
    }

    // Notes — weight 15
    if ((song.notes || "").toLowerCase().includes(t)) {
      score += 15; hit = true;
      if (!seenFields.has("notes")) {
        seenFields.add("notes");
        matchDetails.push({ field: "notes" });
      }
    }

    if (!hit) { allMatched = false; break; }
  }

  if (!allMatched || !score) return null;
  return { score, matchDetails };
}

/**
 * Sidebar with smart multi-field search, pinned songs/albums, and full song list.
 *
 * Props:
 *   songs            — all song records (includes lyrics, beat fields, etc.)
 *   selectedId       — currently selected song id
 *   mainView         — "home" | "song" | "album"
 *   onSelect         — (id) => void
 *   onNew            — () => void
 *   onDelete         — (id) => void
 *   onSettings       — () => void
 *   onGoHome         — () => void
 *   onGoToAlbum      — (albumId) => void  (optional)
 *   pinnedSongIds    — Set<string>  (optional)
 *   pinnedAlbums     — [{id, name}]  (optional)
 *   onTogglePinSong  — (id) => void  (optional)
 *   onTogglePinAlbum — ({id, name}) => void  (optional)
 */
export default function Sidebar({
  songs,
  selectedId,
  mainView,
  onSelect,
  onNew,
  onDelete,
  onSettings,
  onGoHome,
  onGoToAlbum,
  pinnedSongIds,
  pinnedAlbums,
  onTogglePinSong,
  onTogglePinAlbum,
  songColors,
  onSetSongColor,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const isHome    = mainView === "home" || mainView === "album";

  // "/" focuses search; Escape clears it
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;

      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && !isEditable) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearchQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Smart search ─────────────────────────────────────────────────────────────

  const { filteredSongs, matchInfoMap, searchTerms } = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { filteredSongs: songs, matchInfoMap: {}, searchTerms: [] };

    const terms   = q.split(/\s+/).filter(Boolean);
    const results = [];
    const map     = {};

    for (const song of songs) {
      const result = computeMatch(song, terms);
      if (result) {
        results.push({ song, score: result.score });
        if (result.matchDetails.length > 0) {
          map[String(song.id)] = result.matchDetails;
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    return {
      filteredSongs: results.map((r) => r.song),
      matchInfoMap:  map,
      searchTerms:   terms,
    };
  }, [songs, searchQuery]);

  const hasPinnedAlbums = pinnedAlbums?.length > 0;
  const hasPinnedSongs  = pinnedSongIds && songs.some((s) => pinnedSongIds.has(String(s.id)));
  const hasPins         = hasPinnedAlbums || hasPinnedSongs;

  const pinnedSongList = useMemo(() => {
    if (!pinnedSongIds) return [];
    return songs.filter((s) => pinnedSongIds.has(String(s.id)));
  }, [songs, pinnedSongIds]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <aside className="sidebar">
      {/* Brand header */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <SvgWaveform active={false} size={22} />
          <span className="sidebar__brand">BeatPad</span>
          <button
            className="sidebar__settings-btn"
            onClick={onSettings}
            title="Settings"
            aria-label="Open settings"
          >
            <IconGear />
          </button>
        </div>
        <p className="sidebar__tagline">Local songwriting workspace</p>
      </div>

      {/* Library nav button */}
      <button
        className={`sidebar__library-btn${isHome ? " sidebar__library-btn--active" : ""}`}
        onClick={onGoHome}
        title="Music Library"
      >
        <IconLibrary />
        <span>Library</span>
        {songs.length > 0 && (
          <span className="sidebar__library-count">{songs.length}</span>
        )}
      </button>

      {/* Divider */}
      <div className="sidebar__divider" aria-hidden="true" />

      {/* ── Pinned section ──────────────────────────────────────────────────── */}
      {hasPins && (
        <div className="sidebar__pinned">
          <div className="sidebar__pinned-label">Pinned</div>
          <div className="sidebar__pinned-chips">
            {pinnedAlbums?.map((album) => (
              <button
                key={`album-${album.id}`}
                className="sidebar__pinned-chip"
                onClick={() => onGoToAlbum?.(album.id)}
                title={`Go to album: ${album.name}`}
              >
                <span className="sidebar__pinned-chip__icon"><IconAlbum /></span>
                <span className="sidebar__pinned-chip__name">{album.name}</span>
                <button
                  className="sidebar__pinned-chip__remove"
                  onClick={(e) => { e.stopPropagation(); onTogglePinAlbum?.(album); }}
                  title="Unpin album"
                  aria-label={`Unpin album "${album.name}"`}
                >
                  <IconX />
                </button>
              </button>
            ))}

            {pinnedSongList.map((song) => (
              <button
                key={`song-${song.id}`}
                className={`sidebar__pinned-chip${song.id === selectedId ? " sidebar__pinned-chip--active" : ""}`}
                onClick={() => onSelect(song.id)}
                title={`Open: ${song.title}`}
              >
                <span className="sidebar__pinned-chip__icon"><IconSong /></span>
                <span className="sidebar__pinned-chip__name">{song.title}</span>
                <button
                  className="sidebar__pinned-chip__remove"
                  onClick={(e) => { e.stopPropagation(); onTogglePinSong?.(String(song.id)); }}
                  title="Unpin song"
                  aria-label={`Unpin "${song.title}"`}
                >
                  <IconX />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="sidebar__search">
        <div className={`sidebar__search-wrap${searchFocused ? " sidebar__search-wrap--focused" : ""}`}>
          <span className="sidebar__search-icon"><IconSearch /></span>
          <input
            ref={searchRef}
            type="search"
            className="sidebar__search-input"
            placeholder="Search songs, lyrics, beats…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Search songs"
            spellCheck={false}
          />
          {isSearching ? (
            <button
              className="sidebar__search-clear"
              onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
              aria-label="Clear search"
              title="Clear search (Esc)"
            >
              <IconX />
            </button>
          ) : (
            !searchFocused && (
              <span className="sidebar__search-hint" aria-hidden="true">/</span>
            )
          )}
        </div>

        {/* Search field guide — shown briefly on focus when empty */}
        {searchFocused && !isSearching && (
          <div className="sidebar__search-guide">
            Search by title · lyrics · beat · project · completed
          </div>
        )}
      </div>

      {/* Section label */}
      <div className="sidebar__section-label">
        Songs
        {isSearching && (
          <span className="sidebar__section-count">
            {filteredSongs.length > 0
              ? `${filteredSongs.length} of ${songs.length}`
              : `0 of ${songs.length}`}
          </span>
        )}
      </div>

      {/* Song list */}
      <div className="sidebar__songs">
        <SongList
          songs={filteredSongs}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          pinnedSongIds={pinnedSongIds}
          onTogglePin={onTogglePinSong}
          songColors={songColors}
          onSetColor={onSetSongColor}
          searchTerms={searchTerms}
          matchInfoMap={matchInfoMap}
        />
        {isSearching && filteredSongs.length === 0 && (
          <div className="sidebar__search-empty">
            <span className="sidebar__search-empty-icon">🔍</span>
            <span>No songs match</span>
            <span className="sidebar__search-empty-query">"{searchQuery}"</span>
            <span className="sidebar__search-empty-hint">
              Try searching by lyrics, beat name, or project link
            </span>
          </div>
        )}
      </div>

      {/* New song button */}
      <div className="sidebar__footer">
        <button className="btn btn--grad sidebar__new-btn" onClick={onNew}>
          + New Song
        </button>
      </div>
    </aside>
  );
}
