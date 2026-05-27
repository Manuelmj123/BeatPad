import React, { useRef, useState } from "react";
import { startBeatDownload, openDownloadJobStream, uploadBeat } from "../api.js";

const YT_PATTERN =
  /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|music\.youtube\.com|youtube-nocookie\.com)/i;

const ALLOWED_EXTS = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"]);

function clientValidate(url) {
  if (!url.trim()) return "Enter a YouTube URL.";
  if (!YT_PATTERN.test(url)) return "Must be a YouTube link (youtube.com, youtu.be…)";
  return null;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Animated SVG loader used during download/upload */
function SvgLoader({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      fill="none"
      className="beat-dl__svg-loader"
      aria-label="Processing…"
    >
      <circle cx="25" cy="25" r="20" stroke="rgba(232,0,58,0.15)" strokeWidth="4"/>
      <circle
        cx="25" cy="25" r="20"
        stroke="url(#dlGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="80 45"
        className="beat-dl__arc"
      />
      <g transform="translate(13, 17)">
        {[0,1,2,3,4].map((i) => (
          <rect key={i} x={i * 5} y="0" width="3" rx="1.5" height="16"
            fill="rgba(232,0,58,0.5)" className="beat-dl__bar"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </g>
      <defs>
        <linearGradient id="dlGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#E8003A"/>
          <stop offset="100%" stopColor="#FF6040"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 8 12 3 7 8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="3" x2="12" y2="15"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="rgba(232,0,58,0.2)" strokeWidth="1.5"/>
      <path d="M9 18V5l12-2v13" stroke="#E8003A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6"  cy="18" r="3" stroke="#E8003A" strokeWidth="1.5"/>
      <circle cx="18" cy="16" r="3" stroke="#E8003A" strokeWidth="1.5"/>
    </svg>
  );
}

/**
 * Beat panel shown when a song has no beat attached yet.
 * Two modes:
 *   "youtube" — paste a YouTube URL and download via yt-dlp (original behaviour)
 *   "upload"  — drag-and-drop or browse a local audio file
 *
 * Props:
 *   songId      — number
 *   onBeatReady — (beat) => void  — called after success
 *   showToast   — (msg, type) => void
 *   initialUrl  — string  — pre-fill URL (from new-song modal)
 */
export default function BeatDownloader({ songId, onBeatReady, showToast, initialUrl = "" }) {
  // ── Shared ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("youtube"); // "youtube" | "upload"

  // ── YouTube state ───────────────────────────────────────────────────────────
  const [url,        setUrl]        = useState(initialUrl);
  const [valErr,     setValErr]     = useState(null);
  const [ytStatus,   setYtStatus]   = useState("idle"); // idle | downloading | error
  const [lines,      setLines]      = useState([]);
  const [ytError,    setYtError]    = useState("");

  // ── Upload state ────────────────────────────────────────────────────────────
  const [uploadFile,   setUploadFile]   = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState("");
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef(null);

  const isDownloading = ytStatus === "downloading";
  const isBusy        = isDownloading || uploading;

  // ── YouTube handlers ────────────────────────────────────────────────────────

  async function handleDownload() {
    const err = clientValidate(url);
    if (err) { setValErr(err); return; }

    setValErr(null);
    setYtStatus("downloading");
    setLines([]);
    setYtError("");

    try {
      const { jobId } = await startBeatDownload(songId, url.trim());
      openDownloadJobStream(jobId, {
        onLine:     (line)    => setLines((prev) => [...prev, line]),
        onComplete: (payload) => {
          if (payload.success) {
            setYtStatus("idle");
            onBeatReady(payload.beat);
            showToast("Beat downloaded and attached!", "success");
          } else {
            setYtStatus("error");
            setYtError(payload.message || "Download failed.");
          }
        },
        onError: (e) => {
          setYtStatus("error");
          setYtError(e.message);
        },
      });
    } catch (e) {
      setYtStatus("error");
      setYtError(e.data?.error || e.message || "Could not start download.");
    }
  }

  // ── Upload handlers ─────────────────────────────────────────────────────────

  function validateAndSetFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      setUploadError(`"${ext}" isn't supported. Use WAV, MP3, FLAC, AAC, M4A, or OGG.`);
      setUploadFile(null);
      return;
    }
    setUploadError("");
    setUploadFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) validateAndSetFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleUpload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadBeat(songId, uploadFile);
      if (result.success) {
        onBeatReady(result.beat);
        showToast("Beat uploaded and attached!", "success");
        setUploadFile(null);
      }
    } catch (err) {
      setUploadError(err.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="beat-downloader">

      {/* ── Mode tab switcher ── only show when idle */}
      {!isBusy && (
        <div className="beat-downloader__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "youtube"}
            className={`beat-downloader__tab${mode === "youtube" ? " beat-downloader__tab--active" : ""}`}
            onClick={() => { setMode("youtube"); setUploadError(""); }}
          >
            <IconYouTube /> YouTube
          </button>
          <button
            role="tab"
            aria-selected={mode === "upload"}
            className={`beat-downloader__tab${mode === "upload" ? " beat-downloader__tab--active" : ""}`}
            onClick={() => { setMode("upload"); setValErr(null); }}
          >
            <IconUpload /> Upload File
          </button>
        </div>
      )}

      {/* ── Shared header ── */}
      <div className="beat-downloader__header">
        {isBusy
          ? <SvgLoader size={32} />
          : <IconMusic />
        }
        <h3 className="beat-downloader__title">
          {isDownloading ? "Downloading Beat…"
           : uploading    ? "Uploading Beat…"
           : "Attach a Beat"}
        </h3>
      </div>

      {/* ════════════════ YOUTUBE MODE ════════════════ */}
      {mode === "youtube" && (
        <>
          {isDownloading && (
            <div className="beat-downloader__progress-hint">
              <span className="beat-downloader__progress-dot" />
              <span>yt-dlp is extracting audio. This usually takes 30–60 seconds…</span>
            </div>
          )}

          {!isDownloading && (
            <p className="beat-downloader__hint">
              Paste a YouTube beat link — the WAV will be saved to the song's folder.
            </p>
          )}

          <div className="beat-downloader__form">
            <div className={`url-field${valErr ? " url-field--error" : ""}`}>
              <span className="url-field__icon">🔗</span>
              <input
                type="url"
                className="url-field__input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setValErr(null); }}
                onKeyDown={(e) => e.key === "Enter" && !isDownloading && handleDownload()}
                disabled={isDownloading}
                spellCheck={false}
              />
            </div>

            {valErr && <p className="field-error">{valErr}</p>}

            <button
              className={`btn btn--grad beat-downloader__btn${isDownloading ? " btn--loading" : ""}`}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading
                ? <><SvgLoader size={16} />Downloading…</>
                : <>⬇ Download WAV Beat</>}
            </button>
          </div>

          {/* Terminal output */}
          {lines.length > 0 && (
            <div className="terminal">
              <div className="terminal__header">
                <span className="terminal__dot terminal__dot--red"   />
                <span className="terminal__dot terminal__dot--yellow"/>
                <span className="terminal__dot terminal__dot--green" />
                <span className="terminal__title">yt-dlp output</span>
              </div>
              <TerminalBody lines={lines} />
            </div>
          )}

          {ytStatus === "error" && (
            <div className="beat-downloader__error">
              <span className="beat-downloader__error-icon">✕</span>
              <div>
                <p className="beat-downloader__error-title">Download Failed</p>
                <p className="beat-downloader__error-msg">{ytError}</p>
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setYtStatus("idle"); setLines([]); }}
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      {/* ════════════════ UPLOAD MODE ════════════════ */}
      {mode === "upload" && !isBusy && (
        <div className="beat-downloader__upload-section">
          <p className="beat-downloader__hint">
            Upload a local audio file — WAV, MP3, FLAC, AAC, M4A, or OGG.
          </p>

          {/* Drop zone */}
          <div
            className={[
              "bd-dropzone",
              dragOver    ? "bd-dropzone--over"     : "",
              uploadFile  ? "bd-dropzone--has-file" : "",
            ].filter(Boolean).join(" ")}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop audio file here or click to browse"
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,.webm"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {uploadFile ? (
              <div className="bd-dropzone__file">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 18V5l12-2v13" stroke="#00A94F" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6"  cy="18" r="3" stroke="#00A94F" strokeWidth="2"/>
                  <circle cx="18" cy="16" r="3" stroke="#00A94F" strokeWidth="2"/>
                </svg>
                <div className="bd-dropzone__file-info">
                  <span className="bd-dropzone__file-name">{uploadFile.name}</span>
                  <span className="bd-dropzone__file-size">{formatBytes(uploadFile.size)}</span>
                </div>
              </div>
            ) : (
              <div className="bd-dropzone__prompt">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" opacity="0.35" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <p className="bd-dropzone__prompt-text">
                  Drop audio file here<br/>
                  <span className="bd-dropzone__prompt-sub">or click to browse</span>
                </p>
                <span className="bd-dropzone__prompt-hint">
                  WAV · MP3 · FLAC · AAC · M4A · OGG &nbsp;·&nbsp; Max 500 MB
                </span>
              </div>
            )}
          </div>

          {uploadError && <p className="field-error">{uploadError}</p>}

          {uploadFile && (
            <div className="beat-downloader__upload-actions">
              <button
                className="btn btn--grad beat-downloader__btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                <IconUpload /> Attach Beat
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setUploadFile(null); setUploadError(""); }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Busy state for upload ── */}
      {mode === "upload" && uploading && (
        <div className="beat-downloader__progress-hint">
          <span className="beat-downloader__progress-dot" />
          <span>Uploading and saving your beat…</span>
        </div>
      )}
    </div>
  );
}

// ── Terminal sub-component ────────────────────────────────────────────────────

function TerminalBody({ lines }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="terminal__body">
      {lines.map((line, i) => (
        <div key={i} className={`terminal__line ${classifyLine(line)}`}>{line}</div>
      ))}
      <div ref={ref} />
    </div>
  );
}

function classifyLine(line) {
  if (/error/i.test(line))               return "terminal__line--error";
  if (/warning/i.test(line))             return "terminal__line--warn";
  if (/\[download\].*\d+%/.test(line))   return "terminal__line--progress";
  if (/\[ExtractAudio\]|\[ffmpeg\]/i.test(line)) return "terminal__line--info";
  return "";
}
