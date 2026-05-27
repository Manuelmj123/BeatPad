import React, { useEffect, useState } from "react";
import { fetchSongs, addSongsToAlbum } from "../api.js";

const STATUS_COLORS = {
  draft:       "#64748b",
  in_progress: "#60a5fa",
  finished:    "#4ade80",
};

/**
 * Modal for adding existing songs to an album.
 *
 * Props:
 *   albumId       — target album id
 *   albumName     — string (for display)
 *   currentSongIds— Set<number> — songs already in the album
 *   onClose       — () => void
 *   onSuccess     — () => void — called after songs are added
 *   showToast
 */
export default function AddSongsToAlbumModal({ albumId, albumName, currentSongIds, onClose, onSuccess, showToast }) {
  const [allSongs,  setAllSongs]  = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    fetchSongs()
      .then(({ songs }) => setAllSongs(songs ?? []))
      .catch(() => showToast("Could not load songs.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = allSongs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist_name || "").toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const addable = filtered.filter((s) => !currentSongIds.has(s.id));
    const allSelected = addable.every((s) => selected.has(s.id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        addable.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        addable.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  async function handleSave() {
    if (selected.size === 0) { onClose(); return; }
    setSaving(true);
    try {
      await addSongsToAlbum(albumId, [...selected]);
      showToast(`${selected.size} song${selected.size > 1 ? "s" : ""} added to album!`, "success");
      onSuccess();
    } catch (err) {
      showToast(err.message || "Could not add songs.", "error");
    } finally {
      setSaving(false);
    }
  }

  const addable = filtered.filter((s) => !currentSongIds.has(s.id));
  const allSelected = addable.length > 0 && addable.every((s) => selected.has(s.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal add-songs-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-songs-title"
      >
        <div className="modal__header">
          <h2 className="modal__title" id="add-songs-title">
            Add Songs to <em>{albumName}</em>
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          {/* Search */}
          <div className="field">
            <input
              className="field__input"
              placeholder="🔍  Search songs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {loading && (
            <div className="add-songs-modal__loading">
              <div className="workspace__spinner" />
              <span>Loading songs…</span>
            </div>
          )}

          {!loading && allSongs.length === 0 && (
            <p className="add-songs-modal__empty">No songs yet. Create some first!</p>
          )}

          {!loading && allSongs.length > 0 && (
            <>
              {/* Select all toggle */}
              {addable.length > 0 && (
                <button className="add-songs-modal__toggle-all" onClick={toggleAll}>
                  {allSelected ? "Deselect all" : `Select all ${addable.length}`}
                </button>
              )}

              <div className="add-songs-modal__list">
                {filtered.map((song) => {
                  const alreadyIn = currentSongIds.has(song.id);
                  const isSelected = selected.has(song.id);

                  return (
                    <label
                      key={song.id}
                      className={`add-songs-modal__item${alreadyIn ? " add-songs-modal__item--in" : ""}${isSelected ? " add-songs-modal__item--selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected || alreadyIn}
                        disabled={alreadyIn}
                        onChange={() => !alreadyIn && toggle(song.id)}
                        className="add-songs-modal__check"
                      />
                      <span
                        className="add-songs-modal__dot"
                        style={{ background: STATUS_COLORS[song.status] || STATUS_COLORS.draft }}
                      />
                      <span className="add-songs-modal__name">{song.title}</span>
                      {song.artist_name && (
                        <span className="add-songs-modal__artist">{song.artist_name}</span>
                      )}
                      {alreadyIn && <span className="add-songs-modal__badge">Already in album</span>}
                      {song.beat_file_name && !alreadyIn && (
                        <span className="add-songs-modal__beat-dot" title="Has beat attached">♪</span>
                      )}
                    </label>
                  );
                })}

                {filtered.length === 0 && (
                  <p className="add-songs-modal__empty">No songs match "{search}"</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <span className="add-songs-modal__count">
            {selected.size > 0 ? `${selected.size} selected` : ""}
          </span>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className={`btn btn--grad${saving ? " btn--loading" : ""}`}
            onClick={handleSave}
            disabled={saving || selected.size === 0}
          >
            {saving
              ? <><span className="spinner" aria-hidden="true" /> Adding…</>
              : `Add ${selected.size > 0 ? selected.size : ""} Song${selected.size !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
