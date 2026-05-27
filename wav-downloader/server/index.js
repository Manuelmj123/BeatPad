const express = require("express");
const cors    = require("cors");

const { testConnection }  = require("./db/connection");
const { runMigrations }   = require("./db/migrations");
const { getPool }         = require("./db/connection");
const settingsService     = require("./services/settingsService");

const healthRoutes         = require("./routes/health.routes");
const songsRoutes          = require("./routes/songs.routes");
const beatsRoutes          = require("./routes/beats.routes");
const completedSongsRoutes = require("./routes/completedSongs.routes");
const exportRoutes         = require("./routes/export.routes");
const settingsRoutes       = require("./routes/settings.routes");
const albumsRoutes         = require("./routes/albums.routes");

const app  = express();
const PORT = parseInt(process.env.PORT || "5050");

// Allow all origins — this is a local-only tool
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/api/health", healthRoutes);
app.use("/api/songs",  songsRoutes);

// beatsRoutes handles:
//   POST   /api/songs/:songId/download-beat
//   GET    /api/download-jobs/:jobId/events
//   GET    /api/beats/:id/download
//   GET    /api/beats/:id/stream
//   DELETE /api/beats/:id                       (detach a beat)
//   POST   /api/beats/:id/open-folder
//   POST   /api/completed-songs/:id/open-folder
app.use("/api", beatsRoutes);

// completedSongsRoutes handles:
//   POST   /api/songs/:id/completed-song
//   GET    /api/songs/:id/completed-songs
//   PATCH  /api/completed-songs/:id
//   DELETE /api/completed-songs/:id
//   GET    /api/completed-songs/:id/download
//   GET    /api/completed-songs/:id/stream
app.use("/api", completedSongsRoutes);

// exportRoutes handles:
//   GET    /api/songs/:id/export-preview
//   GET    /api/songs/:id/export-txt
//   GET    /api/songs/:id/export-package-preview
//   GET    /api/songs/:id/export-package
//   POST   /api/songs/:id/export-package/save
app.use("/api", exportRoutes);

// settingsRoutes handles:
//   GET    /api/settings
//   PATCH  /api/settings
//   POST   /api/settings/:key/reset
app.use("/api/settings", settingsRoutes);

// albumsRoutes handles:
//   GET    /api/albums
//   POST   /api/albums
//   GET    /api/albums/unassigned
//   GET    /api/albums/:id
//   PATCH  /api/albums/:id
//   DELETE /api/albums/:id
//   POST   /api/albums/:id/cover
//   GET    /api/albums/:id/cover
//   POST   /api/albums/:id/songs
//   DELETE /api/albums/:id/songs/:songId
app.use("/api/albums", albumsRoutes);

// ─── Startup ─────────────────────────────────────────────────────────────────

async function start() {
  console.log("\n🎵  BeatPad server starting…\n");

  // Wait for MySQL — Docker Compose health-check starts the container only after
  // mysqladmin ping passes, but the first real query can still fail briefly.
  let dbOk = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    dbOk = await testConnection();
    if (dbOk) break;
    console.log(`   Waiting for database… (attempt ${attempt}/15)`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (!dbOk) {
    console.error("   ✗ Could not connect to MySQL after 15 attempts. Exiting.");
    process.exit(1);
  }

  // Run safe migrations before accepting traffic
  try {
    await runMigrations(getPool());
  } catch (err) {
    console.error("   ✗ Migration failed:", err.message);
    process.exit(1);
  }

  // Load user-configured paths from DB into the in-memory settings cache
  await settingsService.loadSettings(getPool());

  // Bind to 0.0.0.0 so Docker port-mapping works
  app.listen(PORT, "0.0.0.0", () => {
    const cfg = settingsService.getAll();
    console.log(`   ✓ Database connected`);
    console.log(`   ✓ Server running at http://0.0.0.0:${PORT}`);
    console.log(`   ✓ Downloads path: ${cfg.downloads_path}`);
    console.log(`   ✓ Uploads path:   ${cfg.uploads_path}`);
    console.log(`   ✓ Exports path:   ${cfg.exports_path}`);
    console.log(`   ✓ Platform: ${process.platform}\n`);
  });
}

start();
