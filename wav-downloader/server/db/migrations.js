/**
 * Safe database migration runner.
 * - Never drops tables or deletes data.
 * - Idempotent: safe to run on every startup.
 */

async function runMigrations(pool) {
  console.log("   [migrations] Running database migrations…");

  // ── 1. Create completed_songs table ─────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS completed_songs (
      id                    INT           NOT NULL AUTO_INCREMENT,
      song_id               INT           NOT NULL,
      original_file_name    VARCHAR(500)  NOT NULL,
      stored_file_name      VARCHAR(500)  NOT NULL,
      file_path             TEXT          NOT NULL,
      host_relative_file_path TEXT        NULL,
      file_extension        VARCHAR(30)   NOT NULL,
      mime_type             VARCHAR(150)  NULL,
      file_size_bytes       BIGINT        NULL,
      duration_seconds      DECIMAL(10,2) NULL,
      version_label         VARCHAR(150)  NULL,
      notes                 TEXT          NULL,
      is_primary            BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_completed_songs_song
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      INDEX idx_completed_songs_song_id (song_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("   [migrations] ✓ completed_songs table ready");

  // ── 2. Safely add host_relative_file_path to beats if missing ───────────────
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'beats'
      AND column_name  = 'host_relative_file_path'
  `);

  if (cols.length === 0) {
    await pool.query(`
      ALTER TABLE beats
        ADD COLUMN host_relative_file_path TEXT NULL
          AFTER file_path
    `);
    console.log("   [migrations] ✓ Added host_relative_file_path column to beats");
  } else {
    console.log("   [migrations] ✓ beats.host_relative_file_path already exists");
  }

  // ── 3. Add bandlab_url to songs if missing ───────────────────────────────────
  const [blCol] = await pool.query(`
    SELECT COLUMN_NAME FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'songs' AND column_name = 'bandlab_url'
  `);
  if (blCol.length === 0) {
    await pool.query(`ALTER TABLE songs ADD COLUMN bandlab_url TEXT NULL AFTER notes`);
    console.log("   [migrations] ✓ Added bandlab_url column to songs");
  } else {
    console.log("   [migrations] ✓ songs.bandlab_url already exists");
  }

  // ── 4. Create settings table ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key_name    VARCHAR(100)  NOT NULL,
      value       TEXT          NOT NULL,
      updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (key_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("   [migrations] ✓ settings table ready");

  // ── 5. Create albums table ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id              INT           NOT NULL AUTO_INCREMENT,
      name            VARCHAR(255)  NOT NULL,
      description     TEXT          NULL,
      cover_art_path  TEXT          NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("   [migrations] ✓ albums table ready");

  // ── 6. Create album_songs junction table ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS album_songs (
      id          INT      NOT NULL AUTO_INCREMENT,
      album_id    INT      NOT NULL,
      song_id     INT      NOT NULL,
      position    INT      NOT NULL DEFAULT 0,
      added_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_album_song (album_id, song_id),
      CONSTRAINT fk_album_songs_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      CONSTRAINT fk_album_songs_song  FOREIGN KEY (song_id)  REFERENCES songs(id)  ON DELETE CASCADE,
      INDEX idx_album_songs_album (album_id),
      INDEX idx_album_songs_song  (song_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("   [migrations] ✓ album_songs table ready");

  console.log("   [migrations] All migrations complete.\n");
}

module.exports = { runMigrations };
