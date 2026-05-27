const path = require("path");
const fs   = require("fs");
const { getPool } = require("../db/connection");
const { containerPathToHostRelative } = require("./fileService");
const settingsService = require("./settingsService");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitize a song title into a safe folder name.
 * E.g. "My New Song!" → "my-new-song"
 */
function sanitizeFolderName(title) {
  if (!title) return "untitled";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled";
}

/**
 * Rename the on-disk song folder when a song title changes.
 * Also updates all beat file_path records that reference the old folder.
 */
async function renameSongFolder(songId, oldTitle, newTitle) {
  const oldSlug = sanitizeFolderName(oldTitle);
  const newSlug = sanitizeFolderName(newTitle);
  if (oldSlug === newSlug) return; // Nothing to do

  const downloadsPath = settingsService.getDownloadsPath();
  const oldFolder = path.join(downloadsPath, oldSlug);
  const newFolder = path.join(downloadsPath, newSlug);

  if (!fs.existsSync(oldFolder)) return; // Folder doesn't exist yet

  try {
    // If newFolder already exists, don't clobber it — append a suffix
    let target = newFolder;
    if (fs.existsSync(target)) {
      target = `${newFolder}-${songId}`;
    }
    fs.renameSync(oldFolder, target);

    // Update all beat records for this song that reference the old folder
    const [beats] = await getPool().query("SELECT id, file_path FROM beats WHERE song_id = ?", [songId]);
    for (const beat of beats) {
      if (beat.file_path && beat.file_path.startsWith(oldFolder + path.sep)) {
        const newPath = target + beat.file_path.slice(oldFolder.length);
        await getPool().query("UPDATE beats SET file_path = ? WHERE id = ?", [newPath, beat.id]);
      }
    }

    console.log(`[songService] Renamed folder ${oldFolder} → ${target}`);
  } catch (err) {
    // Non-fatal — log and continue
    console.warn("[songService] Could not rename song folder:", err.message);
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get all songs ordered by last-modified, each with its most recent beat attached.
 */
async function getAllSongs() {
  const [rows] = await getPool().query(`
    SELECT
      s.*,
      b.id                    AS beat_id,
      b.file_name             AS beat_file_name,
      b.youtube_url           AS beat_youtube_url,
      b.original_video_title  AS beat_title,
      (
        SELECT GROUP_CONCAT(cs.original_file_name SEPARATOR '|||')
        FROM completed_songs cs
        WHERE cs.song_id = s.id
      ) AS completed_song_names
    FROM songs s
    LEFT JOIN beats b
      ON b.id = (
        SELECT id FROM beats WHERE song_id = s.id ORDER BY created_at DESC LIMIT 1
      )
    ORDER BY s.updated_at DESC
  `);
  return rows;
}

/**
 * Get a single song with all beats, lyric versions, activity, and completed songs.
 */
async function getSongById(id) {
  const pool = getPool();
  const [[song]] = await pool.query("SELECT * FROM songs WHERE id = ?", [id]);
  if (!song) return null;

  const [beats]    = await pool.query(
    "SELECT * FROM beats WHERE song_id = ? ORDER BY created_at DESC",
    [id]
  );
  const [versions] = await pool.query(
    "SELECT * FROM lyric_versions WHERE song_id = ? ORDER BY created_at DESC LIMIT 20",
    [id]
  );
  const [activity] = await pool.query(
    "SELECT * FROM song_activity WHERE song_id = ? ORDER BY created_at DESC LIMIT 50",
    [id]
  );
  const [completedSongs] = await pool.query(
    "SELECT * FROM completed_songs WHERE song_id = ? ORDER BY is_primary DESC, created_at DESC",
    [id]
  );

  // Enrich beats with hostRelativeFilePath
  const enrichedBeats = beats.map((beat) => ({
    ...beat,
    hostRelativeFilePath: containerPathToHostRelative(beat.file_path),
  }));

  // Enrich completed songs with hostRelativeFilePath
  const enrichedCompletedSongs = completedSongs.map((cs) => ({
    ...cs,
    hostRelativeFilePath: containerPathToHostRelative(cs.file_path),
  }));

  return {
    ...song,
    beats:           enrichedBeats,
    lyric_versions:  versions,
    activity,
    completed_songs: enrichedCompletedSongs,
  };
}

/**
 * Create a new song record. Title defaults to "Untitled" if not provided.
 */
async function createSong(data) {
  const {
    title       = "Untitled",
    artist_name,
    mood,
    bpm,
    key_signature,
    status      = "draft",
    lyrics      = "",
    notes       = "",
    bandlab_url = null,
  } = data;

  const finalTitle = (title || "Untitled").trim() || "Untitled";

  const [result] = await getPool().query(
    `INSERT INTO songs (title, artist_name, mood, bpm, key_signature, status, lyrics, notes, bandlab_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [finalTitle, artist_name || null, mood || null, bpm || null, key_signature || null, status, lyrics, notes, bandlab_url || null]
  );

  await logActivity(result.insertId, "created", `Song "${finalTitle}" created`);
  return getSongById(result.insertId);
}

/**
 * Update allowed fields on a song.
 * If the title changes, also renames the on-disk folder.
 */
async function updateSong(id, data) {
  const ALLOWED = ["title", "artist_name", "mood", "bpm", "key_signature", "status", "lyrics", "notes", "bandlab_url"];
  const setClauses = [];
  const values     = [];

  for (const key of ALLOWED) {
    if (key in data) {
      setClauses.push(`${key} = ?`);
      values.push(data[key] ?? null);
    }
  }

  if (setClauses.length === 0) return getSongById(id);

  // Fetch old title before updating so we can rename folder if needed
  if ("title" in data && data.title) {
    const [[currentSong]] = await getPool().query("SELECT title FROM songs WHERE id = ?", [id]);
    if (currentSong && currentSong.title !== data.title.trim()) {
      await renameSongFolder(id, currentSong.title, data.title.trim());
    }
  }

  values.push(id);
  await getPool().query(`UPDATE songs SET ${setClauses.join(", ")} WHERE id = ?`, values);

  // Log metadata changes (not routine autosaves)
  if (data.status !== undefined) {
    await logActivity(id, "status_changed", `Status changed to "${data.status}"`);
  }

  return getSongById(id);
}

/**
 * Delete a song and all related records (via CASCADE foreign keys).
 * WAV files on disk are NOT deleted.
 */
async function deleteSong(id) {
  await getPool().query("DELETE FROM songs WHERE id = ?", [id]);
}

/**
 * Save an explicit lyric version snapshot.
 */
async function saveLyricVersion(songId, lyrics, versionLabel) {
  const [result] = await getPool().query(
    "INSERT INTO lyric_versions (song_id, lyrics, version_label) VALUES (?, ?, ?)",
    [songId, lyrics, versionLabel || null]
  );
  await logActivity(
    songId,
    "version_saved",
    `Lyric version saved: ${versionLabel || `v${result.insertId}`}`
  );
  return result.insertId;
}

/**
 * Append an activity log entry for a song.
 */
async function logActivity(songId, activityType, message) {
  await getPool().query(
    "INSERT INTO song_activity (song_id, activity_type, message) VALUES (?, ?, ?)",
    [songId, activityType, message]
  );
}

module.exports = {
  getAllSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
  saveLyricVersion,
  logActivity,
  sanitizeFolderName,
};
