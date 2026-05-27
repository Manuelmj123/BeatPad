-- BeatPad Database Schema
-- Runs automatically on first MySQL container start via /docker-entrypoint-initdb.d

CREATE DATABASE IF NOT EXISTS beatpad;
USE beatpad;

-- ─── songs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS songs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(255)  NOT NULL,
  artist_name    VARCHAR(255)  NULL,
  mood           VARCHAR(100)  NULL,
  bpm            INT           NULL,
  key_signature  VARCHAR(50)   NULL,
  status         VARCHAR(50)   NOT NULL DEFAULT 'draft',
  lyrics         LONGTEXT      NULL,
  notes          LONGTEXT      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_songs_updated_at (updated_at),
  INDEX idx_songs_title      (title)
);

-- ─── beats ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beats (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  song_id              INT           NOT NULL,
  youtube_url          TEXT          NULL,
  original_video_title VARCHAR(500)  NULL,
  video_id             VARCHAR(100)  NULL,
  file_name            VARCHAR(500)  NOT NULL,
  file_path            TEXT          NOT NULL,
  downloads_folder     TEXT          NOT NULL,
  file_extension       VARCHAR(20)   NOT NULL DEFAULT 'wav',
  file_size_bytes      BIGINT        NULL,
  duration_seconds     DECIMAL(10,2) NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  INDEX idx_beats_song_id (song_id)
);

-- ─── lyric_versions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lyric_versions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  song_id        INT           NOT NULL,
  lyrics         LONGTEXT      NOT NULL,
  version_label  VARCHAR(100)  NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  INDEX idx_lyric_versions_song_id (song_id)
);

-- ─── song_activity ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_activity (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  song_id        INT           NOT NULL,
  activity_type  VARCHAR(100)  NOT NULL,
  message        TEXT          NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  INDEX idx_song_activity_song_id (song_id)
);
