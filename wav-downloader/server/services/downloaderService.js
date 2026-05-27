const { spawn } = require("child_process");
const path = require("path");
const fs   = require("fs");
const { getDownloadsPath } = require("../utils/paths");

/**
 * Download audio from a YouTube URL and convert to WAV.
 *
 * Saves to <downloadsPath>/<songSlug>/<title>[<id>].wav
 * so each song's beats are neatly organised in their own sub-folder.
 *
 * Uses spawn() with an explicit args array — never shell: true — to prevent
 * command injection. The URL is passed as a single array element.
 *
 * @param {string} url          - Validated YouTube URL
 * @param {string} ytDlpCommand - Resolved binary name (always "yt-dlp" in Docker)
 * @param {string} songSlug     - Safe folder name for the song (e.g. "my-new-track")
 * @param {{ onLine: (l: string) => void, onComplete: (r: object) => void }} cbs
 */
function downloadWav(url, ytDlpCommand, songSlug, { onLine, onComplete }) {
  const downloadsPath = getDownloadsPath();

  // Create a song-specific sub-folder so beats are neatly organised
  const songFolder = path.join(downloadsPath, songSlug || "downloads");
  try {
    fs.mkdirSync(songFolder, { recursive: true });
  } catch (mkdirErr) {
    // Non-fatal – fall back to flat downloads dir
    console.warn("[downloader] Could not create song folder:", mkdirErr.message);
  }

  const targetDir = fs.existsSync(songFolder) ? songFolder : downloadsPath;

  const args = [
    "-x",
    "--audio-format",   "wav",
    "--audio-quality",  "0",
    "-P",               targetDir,
    "-o",               "%(title).120s [%(id)s].%(ext)s",
    // Print the final WAV path after all post-processing so we can record it
    "--print",          "after_move:filepath",
    "--no-playlist",
    "--no-overwrites",
    url,
  ];

  let allLines      = [];
  let finalFilePath = null;

  const proc = spawn(ytDlpCommand, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
      allLines.push(line);
      onLine(line);
      // Capture the --print after_move:filepath output (a bare file path)
      const trimmed = line.trim();
      if (
        (trimmed.endsWith(".wav") || trimmed.endsWith(".WAV")) &&
        (trimmed.includes("/") || trimmed.includes(path.sep))
      ) {
        finalFilePath = trimmed;
      }
    }
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
      allLines.push(line);
      onLine(line);
    }
  });

  proc.on("error", (err) => {
    onComplete({
      success: false,
      message: `Failed to start yt-dlp: ${err.message}`,
      rawError: err.message,
    });
  });

  proc.on("close", (code) => {
    if (code === 0) {
      const fileName = finalFilePath ? path.basename(finalFilePath) : null;
      onComplete({
        success:      true,
        message:      "Download complete",
        downloadsPath: targetDir,
        fileName:     fileName ?? "Check your downloads folder",
        filePath:     finalFilePath ?? targetDir,
      });
    } else {
      const fullOutput = allLines.join("\n");
      onComplete({
        success:  false,
        message:  parseFriendlyError(fullOutput),
        rawError: fullOutput,
      });
    }
  });
}

function parseFriendlyError(output) {
  if (/video unavailable/i.test(output))
    return "This video is unavailable (private, deleted, or region-locked).";
  if (/sign in to confirm|age.?restrict/i.test(output))
    return "This video requires sign-in or is age-restricted.";
  if (/is not a valid url/i.test(output))
    return "yt-dlp rejected the URL. Make sure you copied the full YouTube link.";
  if (/ffmpeg.*not found|no ffmpeg/i.test(output))
    return "FFmpeg was not found inside the container — rebuild the Docker image.";
  if (/network|connection refused|timed? ?out/i.test(output))
    return "Network error. Check your internet connection.";
  if (/copyright|blocked/i.test(output))
    return "This video is blocked due to copyright restrictions.";
  if (/members.?only/i.test(output))
    return "This video is members-only.";
  return "Download failed. See the terminal output for details.";
}

module.exports = { downloadWav };
