import React, { useEffect, useRef, useState } from "react";
import { startBeatDownload, openDownloadJobStream } from "../api.js";

const MOODS = ["Energetic", "Chill", "Melancholy", "Aggressive", "Romantic", "Nostalgic", "Hype", "Soulful"];
const DEFAULT_COLORS = ["#60a5fa", "#f472b6", "#4ade80", "#fb923c", "#a78bfa", "#facc15", "#e8003a", "#94a3b8"];

export default function NewSongModal({ onClose, onCreate, onRefreshSong, showToast, onSetSongColor }) {
  const [form, setForm] = useState({
    title:         "",
    artist_name:   "",
    mood:          "",
    bpm:           "",
    key_signature: "",
    beatUrl:       "",
    color:         "#60a5fa",
  });
  const colorInputRef = useRef(null);
  const [errors,    setErrors]    = useState({});
  const [creating,  setCreating]  = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: null }));
  }

  function validate() {
    const errs = {};
    // Title is now optional — defaults to "Untitled"
    if (form.bpm && (isNaN(form.bpm) || form.bpm < 1 || form.bpm > 300)) {
      errs.bpm = "BPM must be 1–300.";
    }
    return errs;
  }

  async function submit(withBeat) {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setCreating(true);
    try {
      const payload = {
        title:         form.title.trim() || "Untitled",
        artist_name:   form.artist_name.trim() || undefined,
        mood:          form.mood    || undefined,
        bpm:           form.bpm     ? parseInt(form.bpm, 10) : undefined,
        key_signature: form.key_signature.trim() || undefined,
      };

      const newSong = await onCreate(payload);

      // Apply the chosen color immediately
      if (newSong && form.color && onSetSongColor) {
        onSetSongColor(String(newSong.id), form.color);
      }

      // If beat URL was provided and "Create & Download Beat" was clicked
      if (withBeat && form.beatUrl.trim() && newSong) {
        try {
          const { jobId } = await startBeatDownload(newSong.id, form.beatUrl.trim());
          showToast("Beat download started…", "info");
          const capturedSongId = newSong.id;
          openDownloadJobStream(jobId, {
            onLine:     () => {},
            onComplete: (p) => {
              if (p.success) {
                showToast("Beat attached!", "success");
                onRefreshSong?.(capturedSongId);
              } else {
                showToast(p.message || "Beat download failed.", "error");
              }
            },
            onError: () => showToast("Beat download stream disconnected.", "warning"),
          });
        } catch (e) {
          showToast(e.message || "Could not start beat download.", "error");
        }
      }
    } catch {
      // Error already shown by onCreate
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal__header">
          <h2 className="modal__title" id="modal-title">New Song</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          {/* Title — optional */}
          <div className="field">
            <label className="field__label">Song Title</label>
            <input
              ref={titleRef}
              className="field__input"
              placeholder="Untitled"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(false)}
            />
            <p className="field__hint">Leave blank to start as "Untitled" — you can rename it anytime.</p>
          </div>

          {/* Artist */}
          <div className="field">
            <label className="field__label">Artist Name</label>
            <input
              className="field__input"
              placeholder="Optional"
              value={form.artist_name}
              onChange={(e) => set("artist_name", e.target.value)}
            />
          </div>

          {/* Mood + BPM + Key row */}
          <div className="field-row">
            <div className="field">
              <label className="field__label">Mood</label>
              <select className="field__select" value={form.mood} onChange={(e) => set("mood", e.target.value)}>
                <option value="">—</option>
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field__label">BPM</label>
              <input
                className={`field__input${errors.bpm ? " field__input--error" : ""}`}
                type="number"
                min="1" max="300"
                placeholder="140"
                value={form.bpm}
                onChange={(e) => set("bpm", e.target.value)}
              />
              {errors.bpm && <p className="field__error">{errors.bpm}</p>}
            </div>

            <div className="field">
              <label className="field__label">Key</label>
              <input
                className="field__input"
                placeholder="C minor"
                value={form.key_signature}
                onChange={(e) => set("key_signature", e.target.value)}
              />
            </div>
          </div>

          {/* Song Color */}
          <div className="field">
            <label className="field__label">Song Color</label>
            <div className="field--color">
              <span
                className="field__color-preview"
                style={{ background: form.color }}
                title="Click to pick a color"
                onClick={() => colorInputRef.current?.click()}
              >
                <input
                  ref={colorInputRef}
                  type="color"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  aria-hidden="true"
                />
              </span>
              <div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      style={{
                        width: 20, height: 20, borderRadius: "50%", background: c,
                        border: form.color === c ? "2px solid var(--text)" : "2px solid transparent",
                        cursor: "pointer", padding: 0, transition: "transform 0.12s",
                      }}
                      onClick={() => set("color", c)}
                      title={c}
                    />
                  ))}
                </div>
                <span className="field__color-hint">Pick a color to identify this song — you can change it anytime.</span>
              </div>
            </div>
          </div>

          {/* Beat URL — optional */}
          <div className="field">
            <label className="field__label">Beat YouTube URL</label>
            <input
              className="field__input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.beatUrl}
              onChange={(e) => set("beatUrl", e.target.value)}
            />
            <p className="field__hint">
              Optional — start writing without a beat and add one later.
            </p>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => submit(false)}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create Song"}
          </button>
          {form.beatUrl.trim() && (
            <button
              className="btn btn--grad"
              onClick={() => submit(true)}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create & Download Beat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
