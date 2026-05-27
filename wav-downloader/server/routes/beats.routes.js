const express = require("express");
const path    = require("path");
const fs      = require("fs");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const multer  = require("multer");
const router  = express.Router();

const { validateYouTubeUrl, validateId, extractVideoId } = require("../utils/validators");
const { findYtDlp }      = require("../utils/commandExists");
const { getDownloadsPath } = require("../utils/paths");
const { buildStoredFilename } = require("../utils/fileUtils");
const { downloadWav }    = require("../services/downloaderService");
const { saveBeatRecord, getBeatById, deleteBeatById } = require("../services/beatService");
const { logActivity, getSongById, sanitizeFolderName } = require("../services/songService");

// ─── Beat file-upload setup (multer) ─────────────────────────────────────────

const ALLOWED_BEAT_EXTS  = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"]);
const MAX_BEAT_BYTES     = 500 * 1024 * 1024; // 500 MB

// Store temporarily in the downloads root; the route handler moves it to the
// song's sub-folder after looking up the song title.
const beatStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = getDownloadsPath();
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, buildStoredFilename(file.originalname));
  },
});

function beatFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_BEAT_EXTS.has(ext)) {
    return cb(
      Object.assign(
        new Error(`"${ext}" is not allowed. Accepted: WAV, MP3, FLAC, AAC, M4A, OGG`),
        { code: "INVALID_FILE_TYPE" }
      ),
      false
    );
  }
  cb(null, true);
}

const beatUpload = multer({ storage: beatStorage, fileFilter: beatFileFilter, limits: { fileSize: MAX_BEAT_BYTES } });

function multerBeatUpload(req, res, next) {
  beatUpload.single("beat")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `File too large. Maximum is ${MAX_BEAT_BYTES / (1024 * 1024)} MB.` });
    }
    if (err.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || "Upload failed." });
  });
}

// In-memory store for active download jobs
// Shape: Map<jobId, { status, songId, lines, result, clients }>
const downloadJobs = new Map();

// ─── POST /api/songs/:songId/download-beat ───────────────────────────────────
// Validates the URL, checks yt-dlp availability, starts the download as a
// background job, and immediately returns a jobId the client uses for SSE.
router.post("/songs/:songId/download-beat", async (req, res) => {
  const songId = validateId(req.params.songId);
  if (!songId) return res.status(400).json({ error: "Invalid song ID." });

  const { url } = req.body ?? {};
  const validation = validateYouTubeUrl(url);
  if (!validation.valid) return res.status(400).json({ error: validation.reason });

  const ytDlp = await findYtDlp();
  if (!ytDlp.found) {
    return res.status(500).json({
      error:
        "yt-dlp is not available inside the container. " +
        "Rebuild the Docker image with: docker compose up --build",
    });
  }

  const song = await getSongById(songId);
  if (!song) return res.status(404).json({ error: "Song not found." });

  // Build a safe folder name from the song title
  const songSlug = sanitizeFolderName(song.title);

  const jobId = uuidv4();
  downloadJobs.set(jobId, {
    status:  "running",
    songId,
    lines:   [],
    result:  null,
    clients: [],
  });

  // Fire-and-forget download — progress is streamed via SSE
  downloadWav(url.trim(), ytDlp.command, songSlug, {
    onLine(line) {
      const job = downloadJobs.get(jobId);
      if (!job) return;
      job.lines.push(line);
      broadcast(job, { type: "output", line });
    },

    async onComplete(result) {
      const job = downloadJobs.get(jobId);
      if (!job) return;

      if (result.success) {
        try {
          const beat = await saveBeatRecord(songId, {
            youtubeUrl:    url.trim(),
            videoId:       extractVideoId(url),
            fileName:      result.fileName,
            filePath:      result.filePath,
            downloadsFolder: getDownloadsPath(),
          });
          await logActivity(songId, "beat_downloaded", `Beat downloaded: ${result.fileName}`);

          job.status = "done";
          job.result = { ...result, beat };
          broadcast(job, { type: "complete", ...result, beat });
        } catch (dbErr) {
          job.status = "error";
          job.result = {
            success: false,
            message: `Download succeeded but database write failed: ${dbErr.message}`,
          };
          broadcast(job, { type: "complete", ...job.result });
        }
      } else {
        job.status = "error";
        job.result = result;
        broadcast(job, { type: "complete", ...result });
      }

      // Close all SSE connections for this job
      for (const client of job.clients) {
        try { client.end(); } catch { /* ignore */ }
      }
      job.clients = [];
    },
  });

  res.json({ success: true, jobId });
});

// ─── POST /api/songs/:songId/upload-beat ─────────────────────────────────────
// Accept a local audio file upload and attach it as the song's beat.
// Supports WAV, MP3, FLAC, AAC, M4A, OGG (up to 500 MB).
router.post("/songs/:songId/upload-beat", multerBeatUpload, async (req, res) => {
  const songId = validateId(req.params.songId);
  if (!songId) return res.status(400).json({ error: "Invalid song ID." });

  if (!req.file) return res.status(400).json({ error: "No file received." });

  const tmpPath = req.file.path;

  try {
    const song = await getSongById(songId);
    if (!song) {
      fs.unlink(tmpPath, () => {});
      return res.status(404).json({ error: "Song not found." });
    }

    // Move file from downloads root into the song's sub-folder (consistent with
    // what the YouTube downloader does).
    const songSlug   = sanitizeFolderName(song.title);
    const songFolder = path.join(getDownloadsPath(), songSlug);
    fs.mkdirSync(songFolder, { recursive: true });

    const finalPath = path.join(songFolder, req.file.filename);
    fs.renameSync(tmpPath, finalPath);

    const fileExtension = path.extname(req.file.originalname).toLowerCase().slice(1) || "wav";

    const beat = await saveBeatRecord(songId, {
      youtubeUrl:      null,
      videoId:         null,
      videoTitle:      req.file.originalname,   // store original name as "title"
      fileName:        req.file.filename,
      filePath:        finalPath,
      downloadsFolder: getDownloadsPath(),
      fileExtension,
    });

    await logActivity(songId, "beat_uploaded", `Beat uploaded: ${req.file.originalname}`);
    res.json({ success: true, beat });
  } catch (err) {
    // Best-effort cleanup of the temp file
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/download-jobs/:jobId/events ────────────────────────────────────
// Server-Sent Events stream for a download job.
// Replays buffered lines on connect, then streams new ones in real time.
router.get("/download-jobs/:jobId/events", (req, res) => {
  const job = downloadJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Replay already-captured lines for late-connecting clients
  for (const line of job.lines) {
    res.write(sseEvent({ type: "output", line }));
  }

  // If job already finished, send the final event and close
  if (job.status === "done" || job.status === "error") {
    res.write(sseEvent({ type: "complete", ...job.result }));
    res.end();
    return;
  }

  job.clients.push(res);

  req.on("close", () => {
    const j = downloadJobs.get(req.params.jobId);
    if (j) j.clients = j.clients.filter((c) => c !== res);
  });
});

// ─── GET /api/beats/:id/download ─────────────────────────────────────────────
// Stream the WAV file to the browser.
// Security: only files referenced in the DB and inside the downloads dir are served.
router.get("/beats/:id/download", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid beat ID." });

  const beat = await getBeatById(id);
  if (!beat) return res.status(404).json({ error: "Beat not found." });

  const downloadsPath   = path.resolve(getDownloadsPath());
  const resolvedFilePath = path.resolve(beat.file_path);

  // Prevent path traversal: the resolved path must start with the downloads dir
  if (!resolvedFilePath.startsWith(downloadsPath + path.sep) &&
      resolvedFilePath !== downloadsPath) {
    return res.status(403).json({ error: "Access denied." });
  }

  if (!fs.existsSync(resolvedFilePath)) {
    return res.status(404).json({ error: "File not found on disk." });
  }

  res.download(resolvedFilePath, beat.file_name);
});

// ─── GET /api/beats/:id/stream ───────────────────────────────────────────────
// Stream the WAV for in-browser audio playback (supports range requests).
router.get("/beats/:id/stream", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid beat ID." });

  const beat = await getBeatById(id);
  if (!beat) return res.status(404).json({ error: "Beat not found." });

  const downloadsPath    = path.resolve(getDownloadsPath());
  const resolvedFilePath = path.resolve(beat.file_path);

  if (!resolvedFilePath.startsWith(downloadsPath + path.sep) &&
      resolvedFilePath !== downloadsPath) {
    return res.status(403).json({ error: "Access denied." });
  }

  if (!fs.existsSync(resolvedFilePath)) {
    return res.status(404).json({ error: "File not found on disk." });
  }

  res.sendFile(resolvedFilePath);
});

// ─── DELETE /api/beats/:id ────────────────────────────────────────────────────
// Detach (remove from DB) a beat record. File on disk is kept.
router.delete("/beats/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid beat ID." });

  try {
    const result = await deleteBeatById(id);
    if (!result.deleted) return res.status(404).json({ error: "Beat not found." });

    // Log activity
    if (result.beat?.song_id) {
      await logActivity(result.beat.song_id, "beat_detached", `Beat detached: ${result.beat.file_name}`).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/beats/:id/open-folder ─────────────────────────────────────────
// Attempt to open the beat's folder in the host OS file explorer.
// Works when running natively on Windows or macOS.
// When running in Docker/Linux the message will indicate it's unavailable.
router.post("/beats/:id/open-folder", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid beat ID." });

  const beat = await getBeatById(id);
  if (!beat) return res.status(404).json({ error: "Beat not found." });

  const folderPath = path.dirname(beat.file_path);
  openFolderOnHost(folderPath, res);
});

// ─── POST /api/completed-songs/:id/open-folder ───────────────────────────────
// Attempt to open the completed song's folder in the host OS file explorer.
router.post("/completed-songs/:id/open-folder", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid ID." });

  const { getPool } = require("../db/connection");
  const [[cs]] = await getPool().query("SELECT file_path FROM completed_songs WHERE id = ?", [id]);
  if (!cs) return res.status(404).json({ error: "Completed song not found." });

  const folderPath = path.dirname(cs.file_path);
  openFolderOnHost(folderPath, res);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(job, payload) {
  const event = sseEvent(payload);
  for (const client of job.clients) {
    try { client.write(event); } catch { /* client disconnected */ }
  }
}

/**
 * Attempt to open `folderPath` in the host OS file explorer.
 * Sends a JSON response indicating success or the reason for failure.
 */
function openFolderOnHost(folderPath, res) {
  const platform = process.platform;

  if (platform === "win32") {
    // Running natively on Windows
    const winPath = folderPath.replace(/\//g, "\\");
    return exec(`explorer.exe "${winPath}"`, (err) => {
      if (err) return res.json({ success: false, message: `Could not open folder: ${err.message}`, folderPath });
      res.json({ success: true, folderPath });
    });
  }

  if (platform === "darwin") {
    return exec(`open "${folderPath}"`, (err) => {
      if (err) return res.json({ success: false, message: `Could not open folder: ${err.message}`, folderPath });
      res.json({ success: true, folderPath });
    });
  }

  // Linux — running inside Docker on Windows (Docker Desktop / WSL2).
  // Try to reach the Windows host via WSL2 interop (explorer.exe is on PATH
  // when Docker Desktop's WSL integration is enabled).
  exec("which explorer.exe 2>/dev/null || true", (_, explorerPath) => {
    const hasExplorer = explorerPath.trim().length > 0;

    if (!hasExplorer) {
      // No WSL2 interop — just report the container path so the user can find it
      return res.json({
        success: false,
        dockerNote: true,
        folderPath,
        message: `Files are stored at: ${folderPath}`,
      });
    }

    // Convert the Linux container path to a Windows path via wslpath
    exec(`wslpath -w "${folderPath}" 2>/dev/null || echo ""`, (__, wslOut) => {
      const winPath    = wslOut.trim();
      const pathToOpen = winPath || folderPath;

      exec(`explorer.exe "${pathToOpen}"`, (openErr) => {
        if (openErr) {
          // explorer.exe often exits non-zero even on success — treat as success
          // if the error is just a non-zero exit code with no stderr message
          const msg = openErr.message || "";
          if (msg.includes("ENOENT") || msg.includes("not found")) {
            return res.json({ success: false, message: `Could not open: ${msg}`, folderPath: pathToOpen });
          }
        }
        res.json({ success: true, folderPath: pathToOpen });
      });
    });
  });
}

module.exports = router;
