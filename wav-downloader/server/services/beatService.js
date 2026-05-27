const { getPool } = require("../db/connection");
const { getFileSizeBytes, containerPathToHostRelative } = require("./fileService");

/**
 * Save a newly-downloaded or uploaded beat record to the database.
 * fileExtension defaults to 'wav' for backwards-compatibility with the downloader.
 */
async function saveBeatRecord(songId, { youtubeUrl, videoId, videoTitle, fileName, filePath, downloadsFolder, fileExtension }) {
  const fileSizeBytes = getFileSizeBytes(filePath);
  const ext = (fileExtension || "wav").replace(/^\./, "").toLowerCase();

  const [result] = await getPool().query(
    `INSERT INTO beats
       (song_id, youtube_url, original_video_title, video_id, file_name, file_path, downloads_folder, file_extension, file_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [songId, youtubeUrl || null, videoTitle || null, videoId || null, fileName, filePath, downloadsFolder, ext, fileSizeBytes]
  );

  const [[beat]] = await getPool().query("SELECT * FROM beats WHERE id = ?", [result.insertId]);
  return enrichBeat(beat);
}

/**
 * Get a single beat by ID.
 */
async function getBeatById(id) {
  const [[beat]] = await getPool().query("SELECT * FROM beats WHERE id = ?", [id]);
  return beat ? enrichBeat(beat) : null;
}

/**
 * Get all beats for a song, newest first.
 */
async function getBeatsBySongId(songId) {
  const [rows] = await getPool().query(
    "SELECT * FROM beats WHERE song_id = ? ORDER BY created_at DESC",
    [songId]
  );
  return rows.map(enrichBeat);
}

/**
 * Delete (detach) a beat record by ID.
 * The file on disk is NOT deleted — it stays in the downloads folder.
 * Returns { deleted: boolean }
 */
async function deleteBeatById(id) {
  const beat = await getBeatById(id);
  if (!beat) return { deleted: false };

  await getPool().query("DELETE FROM beats WHERE id = ?", [id]);
  return { deleted: true, beat };
}

/**
 * Attach hostRelativeFilePath to a beat record.
 * This tells the frontend where the file lives on the host machine.
 */
function enrichBeat(beat) {
  return {
    ...beat,
    hostRelativeFilePath: containerPathToHostRelative(beat.file_path),
  };
}

module.exports = { saveBeatRecord, getBeatById, getBeatsBySongId, deleteBeatById };
