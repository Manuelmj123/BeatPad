import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function IconPlay({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}
function IconPause({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="18" y1="6"  x2="6"  y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="6"  y1="6"  x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconVolume({ muted }) {
  return muted ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconWarning() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9"  x2="12" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Floating hover-expand music player pill.
 *
 * Collapsed:  52×52 px circle — shows play/pause only.
 * Expanded:   440 px wide pill — shows track name, seek bar, time, volume, close.
 * Expansion is triggered by mouse-enter / focus-within, with a short collapse
 * delay so the user can move between controls without accidental collapse.
 *
 * Props:
 *   track   — { url, name, type: "beat"|"mix" } | null
 *   onClose — () => void
 */
export default function MusicPlayer({ track, onClose }) {
  const audioRef      = useRef(null);
  const playerRef     = useRef(null);
  const collapseTimer = useRef(null);

  const [playing,  setPlaying]  = useState(false);
  const [currentT, setCurrentT] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted,    setMuted]    = useState(false);
  const [volume,   setVolume]   = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── Hover / focus expand logic ─────────────────────────────────────────────
  function openPill() {
    clearTimeout(collapseTimer.current);
    setExpanded(true);
  }
  function closePill() {
    // Brief delay so moving between controls inside the pill doesn't collapse it
    collapseTimer.current = setTimeout(() => setExpanded(false), 380);
  }
  function handleFocusOut(e) {
    // Only collapse if focus truly left the player container
    if (!playerRef.current?.contains(e.relatedTarget)) {
      closePill();
    }
  }

  // Cleanup collapse timer on unmount
  useEffect(() => () => clearTimeout(collapseTimer.current), []);

  // ── Audio wiring — single effect keyed on track URL ───────────────────────
  useEffect(() => {
    if (!track?.url) return;
    const audio = audioRef.current;
    if (!audio) return;

    setPlaying(false); setCurrentT(0); setDuration(0);
    setLoading(true);  setError(false);

    const onTimeUpdate = () => setCurrentT(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration);
    const onEnded      = () => setPlaying(false);
    const onPlay       = () => { setPlaying(true);  setLoading(false); };
    const onPause      = () => setPlaying(false);
    const onCanPlay    = () => setLoading(false);
    const onWaiting    = () => setLoading(true);
    const onError      = () => { setLoading(false); setPlaying(false); setError(true); };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended",          onEnded);
    audio.addEventListener("play",           onPlay);
    audio.addEventListener("pause",          onPause);
    audio.addEventListener("canplay",        onCanPlay);
    audio.addEventListener("waiting",        onWaiting);
    audio.addEventListener("error",          onError);

    audio.load();
    const onCPT = () => {
      audio.play().catch(() => {});
      audio.removeEventListener("canplaythrough", onCPT);
    };
    audio.addEventListener("canplaythrough", onCPT);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("canplay",        onCanPlay);
      audio.removeEventListener("waiting",        onWaiting);
      audio.removeEventListener("error",          onError);
      audio.removeEventListener("canplaythrough", onCPT);
      audio.pause();
    };
  }, [track?.url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else         audio.play().catch(() => {});
  }, [playing]);

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setMuted(v === 0);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
  }

  const progress = duration > 0 ? (currentT / duration) * 100 : 0;

  if (!track) return null;

  return (
    <div
      ref={playerRef}
      className={[
        "music-player",
        expanded ? "music-player--expanded" : "",
        playing  ? "music-player--playing"  : "",
        error    ? "music-player--error"    : "",
      ].filter(Boolean).join(" ")}
      onMouseEnter={openPill}
      onMouseLeave={closePill}
      onFocus={openPill}
      onBlur={handleFocusOut}
    >
      {/* Hidden audio element — always present when track is non-null */}
      <audio ref={audioRef} src={track.url} preload="auto" />

      {/* ── Play / Pause button — always visible ──────────────────────── */}
      <button
        className="mp-play-btn"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        disabled={loading || error}
        title={error ? "Audio failed to load" : playing ? "Pause" : "Play"}
      >
        {loading ? (
          <svg className="mp-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
            <path d="M12 3a9 9 0 019 9" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        ) : error ? (
          <IconWarning />
        ) : (
          playing ? <IconPause /> : <IconPlay />
        )}
      </button>

      {/* ── Expanded pill content ──────────────────────────────────────── */}
      <div className="mp-pill-content" aria-hidden={!expanded}>

        {/* Track info */}
        <div className="mp-track">
          <span className={`mp-track__badge mp-track__badge--${track.type}`}>
            {track.type === "beat" ? "♪" : "🎵"}
          </span>
          {error ? (
            <span className="mp-track__error">Failed to load</span>
          ) : (
            <span className="mp-track__name" title={track.name}>{track.name}</span>
          )}
        </div>

        {/* Seek: time · bar · time */}
        <span className="mp-time-lbl">{formatTime(currentT)}</span>

        <div
          className="mp-progress"
          onClick={seek}
          role="slider"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`${formatTime(currentT)} / ${formatTime(duration)}`}
          tabIndex={expanded ? 0 : -1}
          onKeyDown={(e) => {
            const audio = audioRef.current;
            if (!audio) return;
            if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.currentTime + 5, duration);
            if (e.key === "ArrowLeft")  audio.currentTime = Math.max(audio.currentTime - 5, 0);
          }}
        >
          <div className="mp-progress__fill" style={{ width: `${progress}%` }}>
            <div className="mp-progress__thumb" />
          </div>
        </div>

        <span className="mp-time-lbl mp-time-lbl--dur">{formatTime(duration)}</span>

        {/* Volume */}
        <button
          className="mp-mute-btn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          tabIndex={expanded ? 0 : -1}
        >
          <IconVolume muted={muted} />
        </button>
        <input
          type="range"
          className="mp-volume"
          min="0" max="1" step="0.05"
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
          tabIndex={expanded ? 0 : -1}
        />

        {/* Separator */}
        <span className="mp-sep" aria-hidden="true" />

        {/* Close */}
        <button
          className="mp-close"
          onClick={onClose}
          aria-label="Close player"
          tabIndex={expanded ? 0 : -1}
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}
