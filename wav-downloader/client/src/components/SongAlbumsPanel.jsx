import React, { useCallback, useEffect, useState } from "react";
import {
  fetchSongAlbums, fetchAlbums,
  addSongsToAlbum, removeSongFromAlbum, createAlbum,
  getAlbumCoverUrl,
} from "../api.js";

const GRADIENTS = [
  "linear-gradient(135deg,#E8003A 0%,#FF6040 100%)",
  "linear-gradient(135deg,#6B21A8 0%,#9333EA 100%)",
  "linear-gradient(135deg,#065F46 0%,#059669 100%)",
  "linear-gradient(135deg,#1E40AF 0%,#3B82F6 100%)",
  "linear-gradient(135deg,#92400E 0%,#F59E0B 100%)",
  "linear-gradient(135deg,#1F2937 0%,#4B5563 100%)",
];

function IconAlbum() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6"  cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}
function IconNote() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6"  cy="18" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
      <circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
    </svg>
  );
}

export default function SongAlbumsPanel({ songId, showToast }) {
  const [songAlbums, setSongAlbums] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [allAlbums,  setAllAlbums]  = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [newName,    setNewName]    = useState("");
  const [savingNew,  setSavingNew]  = useState(false);

  const loadSongAlbums = useCallback(async () => {
    if (!songId) return;
    setLoading(true);
    try {
      const { albums } = await fetchSongAlbums(songId);
      setSongAlbums(albums);
    } catch {
      setSongAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => { loadSongAlbums(); }, [loadSongAlbums]);

  async function openPicker() {
    setCreating(false);
    try {
      const { albums: all } = await fetchAlbums();
      const currentIds = new Set(songAlbums.map((a) => a.id));
      setAllAlbums(all.filter((a) => !currentIds.has(a.id)));
      setShowPicker((v) => !v);
    } catch {
      showToast("Could not load albums.", "error");
    }
  }

  async function handleAdd(albumId, albumName) {
    try {
      await addSongsToAlbum(albumId, [songId]);
      showToast(`Added to "${albumName}"!`, "success");
      setShowPicker(false);
      loadSongAlbums();
    } catch (err) {
      showToast(err.message || "Could not add to album.", "error");
    }
  }

  async function handleRemove(albumId, albumName) {
    try {
      await removeSongFromAlbum(albumId, songId);
      showToast(`Removed from "${albumName}"`, "info");
      loadSongAlbums();
    } catch (err) {
      showToast(err.message || "Could not remove.", "error");
    }
  }

  async function handleCreateAndAdd() {
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      const { album } = await createAlbum({ name: newName.trim() });
      await addSongsToAlbum(album.id, [songId]);
      showToast(`Created "${album.name}" and added song!`, "success");
      setCreating(false);
      setNewName("");
      loadSongAlbums();
    } catch (err) {
      showToast(err.message || "Could not create album.", "error");
    } finally {
      setSavingNew(false);
    }
  }

  function startCreating() {
    setShowPicker(false);
    setCreating((v) => !v);
    setNewName("");
  }

  return (
    <div className="song-albums-panel">
      {/* Header */}
      <div className="song-albums-panel__head">
        <span className="song-albums-panel__title">
          <IconAlbum /> Albums
        </span>
        <div className="song-albums-panel__actions">
          <button
            className={`btn btn--secondary btn--sm${showPicker ? " active" : ""}`}
            onClick={openPicker}
            title="Add to an existing album"
          >
            + Add to Album
          </button>
          <button
            className={`btn btn--ghost btn--sm${creating ? " active" : ""}`}
            onClick={startCreating}
            title="Create a new album"
          >
            New Album
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="song-albums-panel__loading">
          <span className="spinner" />
        </div>
      )}

      {/* Album picker dropdown */}
      {!loading && showPicker && (
        <div className="song-albums-panel__picker">
          {allAlbums.length === 0 ? (
            <p className="song-albums-panel__picker-empty">
              All albums already include this song.
            </p>
          ) : (
            <ul className="song-albums-panel__picker-list">
              {allAlbums.map((a) => (
                <li key={a.id}>
                  <button
                    className="song-albums-panel__pick-btn"
                    onClick={() => handleAdd(a.id, a.name)}
                  >
                    <span
                      className="song-albums-panel__pick-thumb"
                      style={{
                        background: a.cover_art_path
                          ? undefined
                          : GRADIENTS[a.id % GRADIENTS.length],
                      }}
                    >
                      {a.cover_art_path
                        ? <img src={getAlbumCoverUrl(a.id)} alt={a.name} />
                        : <IconNote />
                      }
                    </span>
                    <span className="song-albums-panel__pick-name">{a.name}</span>
                    <span className="song-albums-panel__pick-count">
                      {a.song_count} song{a.song_count !== 1 ? "s" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn btn--ghost btn--sm song-albums-panel__picker-cancel"
            onClick={() => setShowPicker(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Create new album inline */}
      {!loading && creating && (
        <div className="song-albums-panel__create">
          <input
            className="song-albums-panel__create-input"
            placeholder="Album name…"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  handleCreateAndAdd();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <div className="song-albums-panel__create-btns">
            <button
              className={`btn btn--grad btn--sm${savingNew ? " btn--loading" : ""}`}
              onClick={handleCreateAndAdd}
              disabled={savingNew || !newName.trim()}
            >
              {savingNew ? <><span className="spinner" />Creating…</> : "Create & Add"}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setCreating(false); setNewName(""); }}
              disabled={savingNew}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current album memberships */}
      {!loading && songAlbums.length === 0 && !showPicker && !creating && (
        <p className="song-albums-panel__empty">Not in any album yet.</p>
      )}

      {!loading && songAlbums.length > 0 && (
        <ul className="song-albums-panel__list">
          {songAlbums.map((a) => (
            <li key={a.id} className="song-albums-panel__item">
              <span
                className="song-albums-panel__item-cover"
                style={{
                  background: a.cover_art_path
                    ? undefined
                    : GRADIENTS[a.id % GRADIENTS.length],
                }}
              >
                {a.cover_art_path
                  ? <img src={getAlbumCoverUrl(a.id)} alt={a.name} />
                  : <IconNote />
                }
              </span>
              <span className="song-albums-panel__item-name">{a.name}</span>
              <button
                className="song-albums-panel__remove-btn"
                onClick={() => handleRemove(a.id, a.name)}
                title={`Remove from "${a.name}"`}
                aria-label={`Remove from ${a.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
