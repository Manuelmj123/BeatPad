/**
 * Settings service — in-memory cache backed by MySQL.
 *
 * The cache is pre-seeded from environment variables so the synchronous
 * getter functions in paths.js / fileService.js keep working.
 * Call loadSettings(pool) once at startup to pull any overrides from the DB.
 */

const path = require("path");
const fs   = require("fs");

// ── Defaults ──────────────────────────────────────────────────────────────────
// Each entry is the env-var fallback so the server works even without a DB row.

const DEFAULTS = {
  downloads_path: process.env.DOWNLOADS_DIR || "/downloads",
  uploads_path:   process.env.UPLOADS_DIR   || "/uploads",
  exports_path:   process.env.EXPORTS_DIR   || "/exports",
};

// Mutable in-memory cache — sync reads, async writes
const cache = { ...DEFAULTS };

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Load settings from the database into the in-memory cache.
 * Called once after the DB connection is established.
 */
async function loadSettings(pool) {
  try {
    const [rows] = await pool.query("SELECT key_name, value FROM settings");
    for (const { key_name, value } of rows) {
      if (Object.prototype.hasOwnProperty.call(cache, key_name)) {
        cache[key_name] = value;
      }
    }
    console.log("   [settings] Loaded from database:", JSON.stringify(cache));
  } catch (err) {
    // Table may not exist yet on very first start — that's fine; defaults apply
    console.log("   [settings] Could not load from DB (using defaults):", err.message);
  }
}

// ── Synchronous reads ─────────────────────────────────────────────────────────

function getDownloadsPath() { return cache.downloads_path; }
function getUploadsPath()   { return cache.uploads_path; }
function getExportsPath()   { return cache.exports_path; }
function getAll()           { return { ...cache }; }

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate that `proposed` is a valid, safe absolute path.
 * The path can be anywhere on the filesystem — not just inside the default volumes.
 * Returns { valid: true, resolved } or { valid: false, reason }.
 */
function validatePath(proposed) {
  if (!proposed || typeof proposed !== "string") {
    return { valid: false, reason: "Path must be a non-empty string." };
  }

  const trimmed = proposed.trim();

  if (!path.isAbsolute(trimmed)) {
    return { valid: false, reason: `Path must be absolute (start with / or a drive letter). Got: "${trimmed}"` };
  }

  const resolved = path.resolve(trimmed);

  // Prevent null bytes or other injection attempts
  if (resolved.includes("\0")) {
    return { valid: false, reason: "Path contains invalid characters." };
  }

  return { valid: true, resolved };
}

/**
 * Ensure a directory exists and is writable.
 * Creates it (and parents) if missing.
 * Returns { ok: true } or { ok: false, reason }.
 */
function ensureWritable(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (mkdirErr) {
    return { ok: false, reason: `Cannot create directory: ${mkdirErr.message}` };
  }

  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
    return { ok: true };
  } catch {
    return { ok: false, reason: `Directory exists but is not writable: ${dirPath}` };
  }
}

// ── Async write ───────────────────────────────────────────────────────────────

/**
 * Validate, apply, and persist a batch of path settings.
 * Accepts any valid absolute path — not restricted to Docker volume roots.
 *
 * @param {object} pool        - mysql2 pool
 * @param {object} proposed    - { downloads_path?, uploads_path?, exports_path? }
 * @returns {{ saved: object, errors: object }}
 */
async function applySettings(pool, proposed) {
  const saved  = {};
  const errors = {};

  for (const [key, rawValue] of Object.entries(proposed)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      errors[key] = `Unknown setting key: "${key}"`;
      continue;
    }

    const check = validatePath(rawValue);

    if (!check.valid) {
      errors[key] = check.reason;
      continue;
    }

    const writable = ensureWritable(check.resolved);
    if (!writable.ok) {
      errors[key] = writable.reason;
      continue;
    }

    // Persist to DB (upsert)
    await pool.query(
      `INSERT INTO settings (key_name, value)
         VALUES (?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [key, check.resolved]
    );

    // Update cache
    cache[key] = check.resolved;
    saved[key] = check.resolved;
  }

  return { saved, errors };
}

// ── Reset one key to its env-var default ──────────────────────────────────────

async function resetToDefault(pool, key) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    throw new Error(`Unknown setting key: "${key}"`);
  }
  const defaultValue = DEFAULTS[key];
  await pool.query(
    `INSERT INTO settings (key_name, value)
       VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
    [key, defaultValue]
  );
  cache[key] = defaultValue;
  return defaultValue;
}

module.exports = {
  loadSettings,
  getDownloadsPath,
  getUploadsPath,
  getExportsPath,
  getAll,
  applySettings,
  resetToDefault,
  DEFAULTS,
};
