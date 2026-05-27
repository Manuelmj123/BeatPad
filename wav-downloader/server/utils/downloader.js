const { spawn } = require("child_process");
const path = require("path");
const { getDownloadsPath } = require("./paths");

/**
 * Download audio from a YouTube URL and convert to WAV via yt-dlp + ffmpeg.
 *
 * @param {string} url           - Validated YouTube URL
 * @param {string} ytDlpCommand  - Resolved path/name of the yt-dlp binary
 * @param {object} callbacks
 *   @param {(line: string) => void} callbacks.onLine     - Called for each output line
 *   @param {(result: object) => void} callbacks.onComplete - Called when done
 */
function downloadWav(url, ytDlpCommand, { onLine, onComplete }) {
  const downloadsPath = getDownloadsPath();

  const args = [
    // Extract audio only
    "-x",
    "--audio-format", "wav",
    "--audio-quality", "0",

    // Output directory
    "-P", downloadsPath,

    // Output template: title (max 120 chars) + video ID to avoid collisions
    "-o", "%(title).120s [%(id)s].%(ext)s",

    // Print the final file path after all post-processing (yt-dlp >= 2022.06)
    "--print", "after_move:filepath",

    // Never download playlists — only the single video
    "--no-playlist",

    // Avoid overwriting files that already exist
    "--no-overwrites",

    url,
  ];

  let allLines = [];
  let finalFilePath = null;

  const proc = spawn(ytDlpCommand, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  // stdout: progress updates and --print output
  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
      allLines.push(line);
      onLine(line);

      // Detect the --print after_move:filepath output.
      // It's a plain filesystem path that ends in .wav / .WAV.
      const trimmed = line.trim();
      if (
        (trimmed.endsWith(".wav") || trimmed.endsWith(".WAV")) &&
        (trimmed.includes(path.sep) || trimmed.includes("/"))
      ) {
        finalFilePath = trimmed;
      }
    }
  });

  // stderr: warnings and errors from yt-dlp / ffmpeg
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
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
        success: true,
        message: "Download completed successfully",
        downloadsPath,
        fileName: fileName ?? "Check your Downloads folder",
        filePath: finalFilePath ?? downloadsPath,
      });
    } else {
      const fullOutput = allLines.join("\n");
      const friendly = parseFriendlyError(fullOutput);

      onComplete({
        success: false,
        message: friendly,
        rawError: fullOutput,
      });
    }
  });
}

/**
 * Produce a human-readable error message from yt-dlp output.
 */
function parseFriendlyError(output) {
  if (/video unavailable/i.test(output))
    return "This video is unavailable — it may be private, deleted, or region-locked.";
  if (/sign in to confirm/i.test(output) || /age.?restrict/i.test(output))
    return "This video requires a sign-in or is age-restricted.";
  if (/is not a valid url/i.test(output))
    return "yt-dlp rejected the URL. Make sure you copied the full YouTube link.";
  if (/ffmpeg.*not found|no ffmpeg/i.test(output))
    return "FFmpeg not found. Install it with: winget install Gyan.FFmpeg — then restart your terminal.";
  if (/network|connection refused|timed? ?out/i.test(output))
    return "Network error. Check your internet connection and try again.";
  if (/copyright|blocked/i.test(output))
    return "This video is blocked due to copyright restrictions.";
  if (/members.?only/i.test(output))
    return "This video is members-only and cannot be downloaded.";

  return "Download failed. See the terminal output below for details.";
}

module.exports = { downloadWav };
