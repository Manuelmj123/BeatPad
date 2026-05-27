const express = require("express");
const router  = express.Router();

const { findYtDlp, findFfmpeg } = require("../utils/commandExists");
const { getDownloadsPath }      = require("../utils/paths");
const { testConnection }        = require("../db/connection");
const { isDownloadsWritable }   = require("../services/fileService");

/**
 * GET /api/health
 * Returns dependency and connectivity status.
 */
router.get("/", async (req, res) => {
  const [ytDlp, ffmpeg, dbOk] = await Promise.all([
    findYtDlp(),
    findFfmpeg(),
    testConnection(),
  ]);

  res.json({
    ok:               ytDlp.found && ffmpeg.found && dbOk,
    ytDlpInstalled:   ytDlp.found,
    ytDlpVersion:     ytDlp.version ?? null,
    ffmpegInstalled:  ffmpeg.found,
    ffmpegVersion:    ffmpeg.version ?? null,
    downloadsPath:    getDownloadsPath(),
    downloadsReady:   isDownloadsWritable(),
    databaseConnected: dbOk,
    platform:         process.platform,
  });
});

module.exports = router;
