const express = require("express");
const path    = require("path");
const fs      = require("fs");
const router  = express.Router();

const { getPool }       = require("../db/connection");
const settingsService   = require("../services/settingsService");
const { isDownloadsWritable, isUploadsWritable, isExportsWritable } = require("../services/fileService");

// ─── GET /api/settings ────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const current  = settingsService.getAll();
  const defaults = settingsService.DEFAULTS;

  res.json({
    settings: {
      downloads_path: {
        value:          current.downloads_path,
        default:        defaults.downloads_path,
        hostRelative:   toHostRelative("downloads", current.downloads_path, defaults.downloads_path),
        writable:       isDownloadsWritable(),
        isDefault:      path.resolve(current.downloads_path) === path.resolve(defaults.downloads_path),
      },
      uploads_path: {
        value:          current.uploads_path,
        default:        defaults.uploads_path,
        hostRelative:   toHostRelative("uploads", current.uploads_path, defaults.uploads_path),
        writable:       isUploadsWritable(),
        isDefault:      path.resolve(current.uploads_path) === path.resolve(defaults.uploads_path),
      },
      exports_path: {
        value:          current.exports_path,
        default:        defaults.exports_path,
        hostRelative:   toHostRelative("exports", current.exports_path, defaults.exports_path),
        writable:       isExportsWritable(),
        isDefault:      path.resolve(current.exports_path) === path.resolve(defaults.exports_path),
      },
    },
  });
});

// ─── PATCH /api/settings ──────────────────────────────────────────────────────
// Accept any valid absolute path — no longer restricted to Docker mount roots.
router.patch("/", async (req, res) => {
  const body = req.body ?? {};
  const allowed = ["downloads_path", "uploads_path", "exports_path"];
  const proposed = {};

  for (const key of allowed) {
    if (key in body) proposed[key] = body[key];
  }

  if (Object.keys(proposed).length === 0) {
    return res.status(400).json({ error: "No valid settings keys provided." });
  }

  try {
    const { saved, errors } = await settingsService.applySettings(getPool(), proposed);
    const hasErrors = Object.keys(errors).length > 0;

    res.status(hasErrors && Object.keys(saved).length === 0 ? 400 : 207).json({
      saved,
      errors,
      message: hasErrors
        ? "Some settings could not be saved — see errors."
        : "Settings saved.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/settings/:key/reset ───────────────────────────────────────────
router.post("/:key/reset", async (req, res) => {
  const { key } = req.params;
  try {
    const value = await settingsService.resetToDefault(getPool(), key);
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/settings/browse ─────────────────────────────────────────────────
// Returns subdirectories of any given absolute path.
// No longer restricted to Docker mount roots — allows browsing the full filesystem.
router.get("/browse", (req, res) => {
  const requestedPath = (req.query.path || "").trim();
  if (!requestedPath) return res.status(400).json({ error: "path query param required." });

  // Safety: must be absolute
  if (!path.isAbsolute(requestedPath)) {
    return res.status(400).json({ error: "Path must be absolute." });
  }

  const resolved = path.resolve(requestedPath);

  // Safety: no null bytes
  if (resolved.includes("\0")) {
    return res.status(400).json({ error: "Invalid path." });
  }

  let dirs = [];
  try {
    dirs = fs.readdirSync(resolved, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    dirs = [];
  }

  // The "base" is the root of the filesystem on this platform
  const base = process.platform === "win32"
    ? path.parse(resolved).root   // e.g. "C:\"
    : "/";

  res.json({ path: resolved, base, dirs });
});

// ─── POST /api/settings/mkdir ──────────────────────────────────────────────────
// Create a new subfolder at any valid absolute path.
router.post("/mkdir", (req, res) => {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) return res.status(400).json({ error: "path required." });

  if (!path.isAbsolute(dirPath)) {
    return res.status(400).json({ error: "Path must be absolute." });
  }

  const resolved = path.resolve(dirPath);

  if (resolved.includes("\0")) {
    return res.status(400).json({ error: "Invalid path." });
  }

  try {
    fs.mkdirSync(resolved, { recursive: true });
    res.json({ success: true, path: resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHostRelative(folderName, current, base) {
  const baseResolved    = path.resolve(base);
  const currentResolved = path.resolve(current);

  if (currentResolved === baseResolved) return `./${folderName}/`;

  const suffix = currentResolved.slice(baseResolved.length);
  return `./${folderName}${suffix.replace(/\\/g, "/")}/`;
}

module.exports = router;
