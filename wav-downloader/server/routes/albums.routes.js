const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const router  = express.Router();

const { validateId }      = require("../utils/validators");
const { getUploadsPath }  = require("../services/fileService");
const {
  getAllAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  addSongsToAlbum,
  removeSongFromAlbum,
  getUnassignedSongs,
} = require("../services/albumService");

// ─── Multer — cover art ───────────────────────────────────────────────────────

const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const coverStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(getUploadsPath(), "album-covers");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `album-${req.params.id}-${Date.now()}${ext}`);
  },
});

const coverUpload = multer({
  storage: coverStorage,
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return cb(new Error("Only image files are accepted (jpg, png, webp, gif)."), false);
    }
    cb(null, true);
  },
});

function coverMiddleware(req, res, next) {
  coverUpload.single("cover")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// ─── GET /api/albums ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const albums = await getAllAlbums();
    res.json({ albums });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/albums/unassigned ───────────────────────────────────────────────
// Must be before /:id to avoid matching "unassigned" as an ID
router.get("/unassigned", async (req, res) => {
  try {
    const songs = await getUnassignedSongs();
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/albums ─────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "Album name is required." });

  try {
    const album = await createAlbum({ name, description });
    res.status(201).json({ album });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/albums/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid album ID." });

  try {
    const album = await getAlbumById(id);
    if (!album) return res.status(404).json({ error: "Album not found." });
    res.json({ album });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/albums/:id ────────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid album ID." });

  const { name, description } = req.body ?? {};
  try {
    const album = await updateAlbum(id, { name, description });
    res.json({ album });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/albums/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid album ID." });

  try {
    const album = await getAlbumById(id);
    // Remove old cover art if present
    if (album?.cover_art_path && fs.existsSync(album.cover_art_path)) {
      try { fs.unlinkSync(album.cover_art_path); } catch { /* ignore */ }
    }
    await deleteAlbum(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/albums/:id/cover ──────────────────────────────────────────────
router.post("/:id/cover", coverMiddleware, async (req, res) => {
  const id = validateId(req.params.id);
  if (!id)       return res.status(400).json({ error: "Invalid album ID." });
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const album = await getAlbumById(id);
    if (!album) return res.status(404).json({ error: "Album not found." });

    // Delete old cover if present
    if (album.cover_art_path && fs.existsSync(album.cover_art_path)) {
      try { fs.unlinkSync(album.cover_art_path); } catch { /* ignore */ }
    }

    const updated = await updateAlbum(id, { coverArtPath: req.file.path });
    res.json({ album: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/albums/:id/cover ────────────────────────────────────────────────
router.get("/:id/cover", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(404).send();

  try {
    const album = await getAlbumById(id);
    if (!album?.cover_art_path || !fs.existsSync(album.cover_art_path)) {
      return res.status(404).send();
    }
    res.sendFile(album.cover_art_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/albums/:id/songs ───────────────────────────────────────────────
router.post("/:id/songs", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid album ID." });

  const { songIds } = req.body ?? {};
  if (!Array.isArray(songIds) || songIds.length === 0) {
    return res.status(400).json({ error: "songIds must be a non-empty array." });
  }

  try {
    const album = await addSongsToAlbum(id, songIds.map(Number));
    res.json({ album });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/albums/:id/songs/:songId ────────────────────────────────────
router.delete("/:id/songs/:songId", async (req, res) => {
  const albumId = validateId(req.params.id);
  const songId  = validateId(req.params.songId);
  if (!albumId || !songId) return res.status(400).json({ error: "Invalid ID." });

  try {
    await removeSongFromAlbum(albumId, songId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
