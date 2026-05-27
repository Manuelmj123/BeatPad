const express = require("express");
const router  = express.Router();

const songService  = require("../services/songService");
const albumService = require("../services/albumService");
const { validateId } = require("../utils/validators");

// GET /api/songs
router.get("/", async (req, res) => {
  try {
    const songs = await songService.getAllSongs();
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/songs/:id/albums — albums that contain this song
router.get("/:id/albums", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const albums = await albumService.getSongAlbums(id);
    res.json({ albums });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/songs/:id
router.get("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await songService.getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });
    res.json({ song });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/songs
// Title is optional — defaults to "Untitled" if omitted or empty.
router.post("/", async (req, res) => {
  try {
    const song = await songService.createSong(req.body ?? {});
    res.status(201).json({ song });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/songs/:id
router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await songService.updateSong(id, req.body);
    if (!song) return res.status(404).json({ error: "Song not found." });
    res.json({ song });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/songs/:id/versions
router.post("/:id/versions", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  const { lyrics, version_label } = req.body ?? {};
  if (!lyrics) return res.status(400).json({ error: "Lyrics content is required." });

  try {
    const versionId = await songService.saveLyricVersion(id, lyrics, version_label);
    res.status(201).json({ success: true, versionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/songs/:id
router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    await songService.deleteSong(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
