import React, { useEffect, useRef, useState } from "react";
import { createAlbum, uploadAlbumCover } from "../api.js";

function IconMusic() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6"  cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
      <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * Modal for creating a new album.
 *
 * Props:
 *   onClose  — () => void
 *   onCreate — (album) => void — called with the newly created album
 *   showToast
 */
export default function CreateAlbumModal({ onClose, onCreate, showToast }) {
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [coverFile,   setCoverFile]   = useState(null);
  const [coverPreview,setCoverPreview]= useState(null);
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState(null);
  const nameRef   = useRef(null);
  const fileRef   = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }

  function handleDropCover(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Album name is required."); return; }
    setCreating(true);
    setError(null);
    try {
      const { album } = await createAlbum({ name: name.trim(), description: description.trim() });

      // Upload cover art if selected
      if (coverFile) {
        try {
          await uploadAlbumCover(album.id, coverFile);
        } catch (err) {
          showToast("Album created but cover art failed to upload.", "warning");
        }
      }

      showToast(`Album "${album.name}" created!`, "success");
      onCreate(album);
    } catch (err) {
      setError(err.message || "Could not create album.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal create-album-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-album-title"
      >
        <div className="modal__header">
          <h2 className="modal__title" id="create-album-title">
            <IconMusic /> New Album
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          {/* Cover art drop zone */}
          <div
            className="album-cover-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropCover}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            title="Click or drag image here"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" className="album-cover-drop__preview" />
            ) : (
              <div className="album-cover-drop__placeholder">
                <IconImage />
                <span>Add cover art</span>
                <span className="album-cover-drop__hint">Click or drag image here</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleCoverChange}
          />

          {/* Album name */}
          <div className="field">
            <label className="field__label">Album Name <span className="field__required">*</span></label>
            <input
              ref={nameRef}
              className={`field__input${error ? " field__input--error" : ""}`}
              placeholder="e.g. Summer 2025"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            {error && <p className="field__error">{error}</p>}
          </div>

          {/* Description */}
          <div className="field">
            <label className="field__label">Description</label>
            <textarea
              className="field__input field__textarea"
              placeholder="What's this album about? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className={`btn btn--grad${creating ? " btn--loading" : ""}`}
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          >
            {creating ? <><span className="spinner" aria-hidden="true" /> Creating…</> : "Create Album"}
          </button>
        </div>
      </div>
    </div>
  );
}
