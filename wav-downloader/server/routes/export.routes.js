const express = require("express");
const router  = express.Router();

const { validateId }       = require("../utils/validators");
const { getSongById }      = require("../services/songService");
const { getExportsPath }   = require("../services/fileService");
const {
  buildTextExport,
  buildPackagePreview,
  streamPackageZip,
  savePackageZip,
} = require("../services/exportService");

// ─── GET /api/songs/:id/export-preview ───────────────────────────────────────
// Returns the formatted text export as a JSON string for preview in the modal.

router.get("/songs/:id/export-preview", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });

    const text = buildTextExport(song);
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/songs/:id/export-txt ───────────────────────────────────────────
// Streams the formatted text file as a download.

router.get("/songs/:id/export-txt", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });

    const safeTitle = (song.title || "song")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);

    const fileName = `${safeTitle}-lyrics.txt`;
    const text     = buildTextExport(song);

    res.setHeader("Content-Type",        "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/songs/:id/export-package-preview ───────────────────────────────
// Returns a JSON preview of what will be included in the ZIP.

router.get("/songs/:id/export-package-preview", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });

    const preview = buildPackagePreview(song);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/songs/:id/export-package ───────────────────────────────────────
// Streams the full ZIP package directly to the browser.

router.get("/songs/:id/export-package", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });

    streamPackageZip(song, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── POST /api/songs/:id/export-package/save ─────────────────────────────────
// Saves the ZIP to the /exports directory and returns the file info.

router.post("/songs/:id/export-package/save", async (req, res) => {
  const id = validateId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid song ID." });

  try {
    const song = await getSongById(id);
    if (!song) return res.status(404).json({ error: "Song not found." });

    const exportsDir = getExportsPath();
    const result     = await savePackageZip(song, exportsDir);

    res.json({
      success:          true,
      fileName:         result.fileName,
      containerPath:    result.containerPath,
      hostRelativePath: result.hostRelativePath,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
