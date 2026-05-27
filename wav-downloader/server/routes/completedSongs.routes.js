const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const router  = express.Router();

const { validateId }              = require("../utils/validators");
const { buildStoredFilename, isSafePath } = require("../utils/fileUtils");
const { getFileSizeBytes, getUploadsPath } = require("../services/fileService");
const {
  saveCompletedSong,
  getCompletedSongsBySongId,
  getCompletedSongById,
  updateCompletedSong,
  deleteCompletedSong,
} = require("../services/completedSongService");

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"]);
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

// Dangerous MIME types that should never be accepted even if extension matches
const BLOCKED_MIME_PREFIXES = ["text/", "application/x-", "application/octet-stream"];
const ALLOWED_MIME_PREFIXES = ["audio/", "video/webm"];

// ─── Multer setup ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadsDir = getUploadsPath();
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const storedName = buildStoredFilename(file.originalname);
    cb(null, storedName);
  },
});

function fileFilter(req, file, cb) {
  const ext      = path.extname(file.originalname).toLowerCase();
  const mimeType = (file.mimetype || "").toLowerCase();

  // Extension check
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      Object.assign(new Error(`File type "${ext}" is not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`), {
        code: "INVALID_FILE_TYPE",
      }),
      false
    );
  }

  // MIME check: must start with an allowed prefix or be application/octet-stream
  // (browsers sometimes send audio files as octet-stream — allow it but log)
  const isAudioMime = ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
  const isOctetStream = mimeType === "application/octet-stream";

  if (!isAudioMime && !isOctetStream && mimeType !== "") {
    return cb(
      Object.assign(new Error(`MIME type "${file.mimetype}" is not allowed for audio uploads.`), {
        code: "INVALID_FILE_TYPE",
      }),
      false
    );
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Wrap multer in a callback so we can handle its errors cleanly
function multerUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      });
    }
    if (err.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || "File upload failed." });
  });
}

// ─── POST /api/songs/:id/completed-song ──────────────────────────────────────

router.post("/songs/:id/completed-song", multerUpload, async (req, res) => {
  const songId = validateId(req.params.id);
  if (!songId) return res.status(400).json({ error: "Invalid song ID." });

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Include a 'file' field." });
  }

  const { versionLabel, notes, isPrimary } = req.body ?? {};

  const fileData = {
    originalFileName: req.file.originalname,
    storedFileName:   req.file.filename,
    filePath:         req.file.path,
    fileExtension:    path.extname(req.file.originalname).toLowerCase(),
    mimeType:         req.file.mimetype || null,
    fileSizeBytes:    req.file.size || getFileSizeBytes(req.file.path),
  };

  const metadata = {
    versionLabel: versionLabel || null,
    notes:        notes || null,
    isPrimary:    isPrimary !== "false" && isPrimary !== false,
  };

  try {
    const record = await saveCompletedSong(songId, fileData, metadata);
    res.status(201).json({ success: true, completedSong: record });
  } catch (err) {
    console.error("[completedSongs] saveCompletedSong error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/songs/:id/completed-songs ──────────────────────────────────────

router.get("/songs/:id/completed-songs", async (req, res) => {
  const songId = validateId(req.params.id);
  if (!songId) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const records = await getCompletedSongsBySongId(songId);
    res.json({ completedSongs: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/completed-songs/:id ──────────────────────────────────────────

router.patch("/completed-songs/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid completed song ID." });

  const { versionLabel, notes, isPrimary } = req.body ?? {};

  try {
    const updated = await updateCompletedSong(id, { versionLabel, notes, isPrimary });
    if (!updated) return res.status(404).json({ error: "Completed song not found." });
    res.json({ success: true, completedSong: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/completed-songs/:id ─────────────────────────────────────────

router.delete("/completed-songs/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid completed song ID." });

  try {
    const result = await deleteCompletedSong(id);
    if (!result.deleted) return res.status(404).json({ error: "Completed song not found." });
    res.json({ success: true, fileDeleted: result.fileDeleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/completed-songs/:id/download ───────────────────────────────────

router.get("/completed-songs/:id/download", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid completed song ID." });

  try {
    const record = await getCompletedSongById(id);
    if (!record) return res.status(404).json({ error: "Completed song not found." });

    const uploadsDir   = path.resolve(getUploadsPath());
    const resolvedFile = path.resolve(record.file_path);

    if (!isSafePath(uploadsDir, resolvedFile)) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!fs.existsSync(resolvedFile)) {
      return res.status(404).json({ error: "File not found on disk." });
    }

    res.download(resolvedFile, record.original_file_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/completed-songs/:id/stream ─────────────────────────────────────
// Uses res.sendFile so browsers can make range requests for audio playback.

router.get("/completed-songs/:id/stream", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid completed song ID." });

  try {
    const record = await getCompletedSongById(id);
    if (!record) return res.status(404).json({ error: "Completed song not found." });

    const uploadsDir   = path.resolve(getUploadsPath());
    const resolvedFile = path.resolve(record.file_path);

    if (!isSafePath(uploadsDir, resolvedFile)) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!fs.existsSync(resolvedFile)) {
      return res.status(404).json({ error: "File not found on disk." });
    }

    res.sendFile(resolvedFile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
