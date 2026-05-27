import React, { useState, useRef } from "react";
import SvgUploadCloud          from "./SvgUploadCloud.jsx";
import CompletedSongCard       from "./CompletedSongCard.jsx";
import CompletedSongUploadModal from "./CompletedSongUploadModal.jsx";

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"];

/**
 * Panel for uploading and viewing completed song recordings.
 *
 * Props:
 *   song         — full song object (has completed_songs array)
 *   onRefresh    — () => void
 *   showToast    — (msg, type) => void
 *   onPlaySong   — (cs) => void — play a completed song in the music player
 */
export default function CompletedSongPanel({ song, onRefresh, showToast, onPlaySong }) {
  const [isDragOver,    setIsDragOver]    = useState(false);
  const [showUpload,    setShowUpload]    = useState(false);
  const [preselectedFile, setPreselectedFile] = useState(null);
  const [showSecondary, setShowSecondary] = useState(false);

  const completedSongs = Array.isArray(song?.completed_songs) ? song.completed_songs : [];
  const primarySong    = completedSongs.find((cs) => cs.is_primary) || completedSongs[0] || null;
  const secondarySongs = completedSongs.filter((cs) => cs !== primarySong);

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files || []);
    const audioFile = files.find((f) => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      return ACCEPTED_EXTENSIONS.includes(ext);
    });

    if (audioFile) {
      setPreselectedFile(audioFile);
      setShowUpload(true);
    } else if (files.length > 0) {
      showToast("Unsupported file type. Accepted: " + ACCEPTED_EXTENSIONS.join(", "), "error");
    }
  }

  function openUploadModal(file = null) {
    setPreselectedFile(file);
    setShowUpload(true);
  }

  function handleUploadSuccess() {
    setShowUpload(false);
    setPreselectedFile(null);
    onRefresh();
    showToast("Completed song uploaded!", "success");
  }

  return (
    <div className="completed-song-panel">
      <div className="beat-panel__title completed-song-panel__heading">
        Completed Song
        {completedSongs.length > 0 && (
          <span className="cs-count-badge">{completedSongs.length}</span>
        )}
      </div>

      {/* Empty state: drop zone */}
      {completedSongs.length === 0 && (
        <div
          className={`upload-zone${isDragOver ? " upload-zone--dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => openUploadModal()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && openUploadModal()}
          aria-label="Upload completed song"
        >
          <div className="upload-zone__cloud">
            <SvgUploadCloud size={44} />
          </div>
          <p className="upload-zone__label">
            {isDragOver ? "Drop your file here" : "Upload Completed Song"}
          </p>
          <p className="upload-zone__hint">Drag & drop or click to browse</p>
          <p className="upload-zone__formats">
            {ACCEPTED_EXTENSIONS.join("  ")}
          </p>
        </div>
      )}

      {/* Has songs: show primary card + secondary + add button */}
      {completedSongs.length > 0 && (
        <div
          className={`cs-songs-area${isDragOver ? " cs-songs-area--dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {primarySong && (
            <CompletedSongCard
              completedSong={primarySong}
              onRefresh={onRefresh}
              showToast={showToast}
              onPlay={onPlaySong}
            />
          )}

          {secondarySongs.length > 0 && (
            <div className="cs-secondary">
              <button
                className="cs-secondary__toggle"
                onClick={() => setShowSecondary((v) => !v)}
              >
                {showSecondary ? "▲" : "▼"} {secondarySongs.length} other version{secondarySongs.length !== 1 ? "s" : ""}
              </button>

              {showSecondary && (
                <div className="cs-secondary__list">
                  {secondarySongs.map((cs) => (
                    <CompletedSongCard
                      key={cs.id}
                      completedSong={cs}
                      onRefresh={onRefresh}
                      showToast={showToast}
                      compact
                      onPlay={onPlaySong}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn--ghost btn--sm cs-add-btn"
            onClick={() => openUploadModal()}
          >
            + Add Another Version
          </button>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <CompletedSongUploadModal
          songId={song.id}
          preselectedFile={preselectedFile}
          onClose={() => { setShowUpload(false); setPreselectedFile(null); }}
          onSuccess={handleUploadSuccess}
          showToast={showToast}
        />
      )}
    </div>
  );
}
