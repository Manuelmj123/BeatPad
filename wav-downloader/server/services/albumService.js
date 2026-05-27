const { getPool } = require("../db/connection");

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADIENT_CLASSES = [
  "grad-red", "grad-purple", "grad-green",
  "grad-blue", "grad-amber", "grad-dark",
];

function albumGradient(id) {
  return GRADIENT_CLASSES[id % GRADIENT_CLASSES.length];
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * List all albums with per-album song counts and status breakdown.
 */
async function getAllAlbums() {
  const [albums] = await getPool().query(`
    SELECT
      a.*,
      COUNT(DISTINCT als.song_id)               AS song_count,
      SUM(s.status = 'finished')                AS finished_count,
      SUM(s.status = 'in_progress')             AS in_progress_count,
      SUM(s.status = 'draft' OR s.status IS NULL) AS draft_count
    FROM albums a
    LEFT JOIN album_songs als ON als.album_id = a.id
    LEFT JOIN songs       s   ON s.id = als.song_id
    GROUP BY a.id
    ORDER BY a.updated_at DESC
  `);
  return albums.map((a) => ({ ...a, gradient: albumGradient(a.id) }));
}

/**
 * Get a single album with all its songs (ordered by position then creation date).
 */
async function getAlbumById(id) {
  const [[album]] = await getPool().query("SELECT * FROM albums WHERE id = ?", [id]);
  if (!album) return null;

  const [songs] = await getPool().query(`
    SELECT
      s.*,
      als.position,
      als.added_at,
      b.id           AS beat_id,
      b.file_name    AS beat_file_name,
      b.youtube_url  AS beat_youtube_url
    FROM songs s
    JOIN  album_songs als ON als.song_id = s.id AND als.album_id = ?
    LEFT JOIN beats b ON b.id = (
      SELECT id FROM beats WHERE song_id = s.id ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY als.position ASC, s.created_at DESC
  `, [id]);

  return { ...album, gradient: albumGradient(album.id), songs };
}

/**
 * Create a new album.
 */
async function createAlbum({ name, description }) {
  const [result] = await getPool().query(
    "INSERT INTO albums (name, description) VALUES (?, ?)",
    [name.trim(), description?.trim() || null]
  );
  return getAlbumById(result.insertId);
}

/**
 * Update album name, description, and/or cover_art_path.
 */
async function updateAlbum(id, { name, description, coverArtPath }) {
  const setClauses = [];
  const values     = [];

  if (name         !== undefined) { setClauses.push("name = ?");           values.push(name?.trim() || null); }
  if (description  !== undefined) { setClauses.push("description = ?");    values.push(description?.trim() || null); }
  if (coverArtPath !== undefined) { setClauses.push("cover_art_path = ?"); values.push(coverArtPath); }

  if (setClauses.length === 0) return getAlbumById(id);

  values.push(id);
  await getPool().query(`UPDATE albums SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getAlbumById(id);
}

/**
 * Delete an album. Songs are NOT deleted (only the junction records).
 */
async function deleteAlbum(id) {
  await getPool().query("DELETE FROM albums WHERE id = ?", [id]);
  return { deleted: true };
}

/**
 * Add one or more songs to an album (ignores duplicates).
 */
async function addSongsToAlbum(albumId, songIds) {
  const pool = getPool();
  const [[{ maxPos }]] = await pool.query(
    "SELECT COALESCE(MAX(position), -1) AS maxPos FROM album_songs WHERE album_id = ?",
    [albumId]
  );
  let pos = maxPos + 1;
  for (const songId of songIds) {
    await pool.query(
      "INSERT IGNORE INTO album_songs (album_id, song_id, position) VALUES (?, ?, ?)",
      [albumId, songId, pos++]
    );
  }
  return getAlbumById(albumId);
}

/**
 * Remove a song from an album (song itself is kept).
 */
async function removeSongFromAlbum(albumId, songId) {
  await getPool().query(
    "DELETE FROM album_songs WHERE album_id = ? AND song_id = ?",
    [albumId, songId]
  );
  return { removed: true };
}

/**
 * Get songs that do not belong to any album.
 */
async function getUnassignedSongs() {
  const [songs] = await getPool().query(`
    SELECT
      s.*,
      b.id           AS beat_id,
      b.file_name    AS beat_file_name,
      b.youtube_url  AS beat_youtube_url
    FROM songs s
    LEFT JOIN album_songs als ON als.song_id = s.id
    LEFT JOIN beats b ON b.id = (
      SELECT id FROM beats WHERE song_id = s.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE als.song_id IS NULL
    ORDER BY s.updated_at DESC
  `);
  return songs;
}

/**
 * Get all albums that contain a given song.
 */
async function getSongAlbums(songId) {
  const [albums] = await getPool().query(`
    SELECT a.id, a.name, a.description, a.cover_art_path, a.created_at, a.updated_at
    FROM albums a
    JOIN album_songs als ON als.album_id = a.id
    WHERE als.song_id = ?
    ORDER BY als.added_at ASC
  `, [songId]);
  return albums.map((a) => ({ ...a, gradient: albumGradient(a.id) }));
}

module.exports = {
  getAllAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  addSongsToAlbum,
  removeSongFromAlbum,
  getUnassignedSongs,
  getSongAlbums,
};
