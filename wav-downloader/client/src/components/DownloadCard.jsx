import React, { useState } from "react";
import { startDownload, openJobStream } from "../api.js";
import AnimatedWaveform from "./AnimatedWaveform.jsx";
import TerminalOutput from "./TerminalOutput.jsx";
import SuccessState from "./SuccessState.jsx";
import ErrorState from "./ErrorState.jsx";

// Quick client-side URL check before hitting the API
const YT_PATTERN =
  /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|music\.youtube\.com|youtube-nocookie\.com)/i;

function clientValidateUrl(url) {
  if (!url.trim()) return "Please enter a YouTube URL.";
  if (!url.startsWith("http://") && !url.startsWith("https://"))
    return "URL must start with https://";
  if (!YT_PATTERN.test(url))
    return "URL must be a YouTube link (youtube.com, youtu.be, music.youtube.com…)";
  return null; // valid
}

/** @type {"idle"|"downloading"|"success"|"error"} */
const IDLE = "idle";
const DOWNLOADING = "downloading";
const SUCCESS = "success";
const ERROR = "error";

export default function DownloadCard({ health }) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [status, setStatus] = useState(IDLE);
  const [lines, setLines] = useState([]);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const isDownloading = status === DOWNLOADING;

  // Both deps must be present to allow downloading
  const canDownload =
    health !== null && health.ytDlpInstalled && health.ffmpegInstalled;

  function handleUrlChange(e) {
    setUrl(e.target.value);
    if (validationError) setValidationError(null);
  }

  async function handleDownload() {
    // Client-side validation
    const err = clientValidateUrl(url);
    if (err) {
      setValidationError(err);
      return;
    }

    // Reset state for new download
    setValidationError(null);
    setStatus(DOWNLOADING);
    setLines([]);
    setResult(null);
    setErrorMessage("");

    try {
      const { jobId } = await startDownload(url.trim());

      openJobStream(jobId, {
        onLine: (line) => setLines((prev) => [...prev, line]),

        onComplete: (payload) => {
          if (payload.success) {
            setResult(payload);
            setStatus(SUCCESS);
          } else {
            setErrorMessage(payload.message ?? "Download failed.");
            setStatus(ERROR);
          }
        },

        onError: (e) => {
          setErrorMessage(e.message ?? "Connection to server lost.");
          setStatus(ERROR);
        },
      });
    } catch (e) {
      setErrorMessage(e.data?.message ?? e.message ?? "Failed to start download.");
      setStatus(ERROR);
    }
  }

  function handleReset() {
    setStatus(IDLE);
    setUrl("");
    setLines([]);
    setResult(null);
    setErrorMessage("");
    setValidationError(null);
  }

  return (
    <div className="download-card">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="card-header">
        <MusicNoteIcon />
        <AnimatedWaveform active={isDownloading} />
      </div>

      <h1 className="card-title">YouTube → WAV</h1>
      <p className="card-subtitle">
        Paste a YouTube URL and download the audio as a high-quality WAV file
      </p>

      {/* ── URL input (hidden after success) ─────────────────────── */}
      {status !== SUCCESS && (
        <div className="input-group">
          <div className={`url-input-wrap${validationError ? " input-error" : ""}`}>
            <span className="input-icon" aria-hidden="true">🔗</span>
            <input
              type="url"
              className="url-input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={handleUrlChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isDownloading) handleDownload();
              }}
              disabled={isDownloading}
              spellCheck={false}
              aria-label="YouTube URL"
            />
          </div>

          {validationError && (
            <p className="validation-error" role="alert">
              {validationError}
            </p>
          )}

          <button
            className={`download-btn${isDownloading ? " btn-loading" : ""}`}
            onClick={handleDownload}
            disabled={isDownloading || !canDownload}
            aria-busy={isDownloading}
          >
            {isDownloading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Downloading…
              </>
            ) : (
              <>
                <DownloadArrowIcon />
                Download WAV
              </>
            )}
          </button>

          {health !== null && !canDownload && (
            <p className="dep-warning">
              ⚠ Install yt-dlp and FFmpeg (see status above) before downloading.
            </p>
          )}
        </div>
      )}

      {/* ── Live terminal output ───────────────────────────────────── */}
      <TerminalOutput
        lines={lines}
        visible={isDownloading || lines.length > 0}
      />

      {/* ── Result states ─────────────────────────────────────────── */}
      {status === SUCCESS && result && (
        <>
          <SuccessState result={result} />
          <button className="btn btn-ghost reset-btn" onClick={handleReset}>
            ↩ Download another
          </button>
        </>
      )}

      {status === ERROR && (
        <>
          <ErrorState message={errorMessage} />
          <button className="btn btn-ghost reset-btn" onClick={handleReset}>
            ↩ Try again
          </button>
        </>
      )}

      {/* ── Footer note ───────────────────────────────────────────── */}
      <p className="card-footer-note">
        Files are saved to your Windows <strong>Downloads</strong> folder
      </p>
    </div>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function MusicNoteIcon() {
  return (
    <svg
      className="music-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 18V5l12-2v13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DownloadArrowIcon() {
  return (
    <svg
      className="btn-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v13m0 0l-4-4m4 4l4-4M3 19h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
