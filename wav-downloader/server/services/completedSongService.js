const fs   = require("fs");
const path = require("path");
const { getPool }                      = require("../db/connection");
const { containerPathToHostRelative, getUploadsPath } = require("./fileService");
const { logActivity }                  = require("./songService");

/**
 * Enrich a completed_song row with hostRelativeFilePath.
 */
function enrichCompletedSong(cs) {
  return {
    ...cs,
    hostRelativeFilePath: containerPathToHostRelative(cs.file_path),
  };
}

/**
 * Save a new completed song record.
 *
 * @param {number} songId
 * @param {{ originalFileName, storedFileName, filePath, fileExtension, mimeType, fileSizeBytes }} fileData
 * @param {{ versionLabel, notes, isPrimary }} metadata
 * @returns {Promise<object>} enriched record
 */
async function saveCompletedSong(songId, fileData, metadata = {}) {
  const pool = getPool();
  const isPrimary = metadata.isPrimary !== false; // default true

  // If this is being set as primary, clear existing primaries
  if (isPrimary) {
    await pool.query(
      "UPDATE completed_songs SET is_primary = FALSE WHERE song_id = ?",
      [songId]
    );
  }

  const [result] = await pool.query(
    `INSERT INTO completed_songs
       (song_id, original_file_name, stored_file_name, file_path,
        file_extension, mime_type, file_size_bytes, version_label, notes, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      songId,
      fileData.originalFileName,
      fileData.storedFileName,
      fileData.filePath,
      fileData.fileExtension,
      fileData.mimeType || null,
      fileData.fileSizeBytes || null,
      metadata.versionLabel || null,
      metadata.notes || null,
      isPrimary,
    ]
  );

  const label = metadata.versionLabel
    ? `"${metadata.versionLabel}"`
    : fileData.originalFileName;
  await logActivity(songId, "completed_song_uploaded", `Completed song uploaded: ${label}`);

  const [[record]] = await pool.query(
    "SELECT * FROM completed_songs WHERE id = ?",
    [result.insertId]
  );
  return enrichCompletedSong(record);
}

/**
 * Get all completed songs for a song_id, ordered primary-first then newest.
 *
 * @param {number} songId
 * @returns {Promise<object[]>}
 */
async function getCompletedSongsBySongId(songId) {
  const [rows] = await getPool().query(
    "SELECT * FROM completed_songs WHERE song_id = ? ORDER BY is_primary DESC, created_at DESC",
    [songId]
  );
  return rows.map(enrichCompletedSong);
}

/**
 * Get a single completed song by its own ID.
 *
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getCompletedSongById(id) {
  const [[record]] = await getPool().query(
    "SELECT * FROM completed_songs WHERE id = ?",
    [id]
  );
  return record ? enrichCompletedSong(record) : null;
}

/**
 * Update version label, notes, and/or isPrimary on a completed song.
 * If setting isPrimary=true, cascades FALSE to all other records for the same song.
 *
 * @param {number} id
 * @param {{ versionLabel?, notes?, isPrimary? }} data
 * @returns {Promise<object>} enriched updated record
 */
async function updateCompletedSong(id, data) {
  const pool = getPool();

  const [[existing]] = await pool.query(
    "SELECT * FROM completed_songs WHERE id = ?",
    [id]
  );
  if (!existing) return null;

  const setClauses = [];
  const values     = [];

  if ("versionLabel" in data) {
    setClauses.push("version_label = ?");
    values.push(data.versionLabel || null);
  }
  if ("notes" in data) {
    setClauses.push("notes = ?");
    values.push(data.notes || null);
  }
  if ("isPrimary" in data) {
    setClauses.push("is_primary = ?");
    values.push(data.isPrimary ? 1 : 0);

    // Cascade: if setting as primary, clear all others for the same song
    if (data.isPrimary) {
      await pool.query(
        "UPDATE completed_songs SET is_primary = FALSE WHERE song_id = ? AND id != ?",
        [existing.song_id, id]
      );
    }
  }

  if (setClauses.length > 0) {
    values.push(id);
    await pool.query(
      `UPDATE completed_songs SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );
  }

  const [[updated]] = await pool.query(
    "SELECT * FROM completed_songs WHERE id = ?",
    [id]
  );
  return enrichCompletedSong(updated);
}

/**
 * Delete a completed song DB record AND its file from disk.
 * The file is only deleted if it lives under the /uploads directory.
 *
 * @param {number} id
 * @returns {Promise<{ deleted: boolean, fileDeleted: boolean }>}
 */
async function deleteCompletedSong(id) {
  const [[record]] = await getPool().query(
    "SELECT * FROM completed_songs WHERE id = ?",
    [id]
  );
  if (!record) return { deleted: false, fileDeleted: false };

  // Delete DB record first
  await getPool().query("DELETE FROM completed_songs WHERE id = ?", [id]);

  // Only delete the physical file if it is inside /uploads
  let fileDeleted = false;
  const uploadsDir = getUploadsPath();
  if (record.file_path && record.file_path.startsWith(uploadsDir)) {
    try {
      const resolvedPath = path.resolve(record.file_path);
      const resolvedUploads = path.resolve(uploadsDir);
      // Extra safety: resolved path must still start with uploads dir
      if (
        resolvedPath.startsWith(resolvedUploads + path.sep) ||
        resolvedPath === resolvedUploads
      ) {
        if (fs.existsSync(resolvedPath)) {
          fs.unlinkSync(resolvedPath);
          fileDeleted = true;
        }
      }
    } catch (err) {
      console.error("[completedSongService] Could not delete file:", err.message);
    }
  }

  return { deleted: true, fileDeleted };
}

module.exports = {
  saveCompletedSong,
  getCompletedSongsBySongId,
  getCompletedSongById,
  updateCompletedSong,
  deleteCompletedSong,
};
