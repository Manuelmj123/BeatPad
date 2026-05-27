const { spawn } = require("child_process");

/**
 * Check whether a binary is callable and returns output.
 */
function checkCommand(command, args) {
  return new Promise((resolve) => {
    let output = "";
    let proc;

    try {
      proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });
    } catch {
      return resolve({ found: false, version: null });
    }

    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (output += d.toString()));
    proc.on("error", () => resolve({ found: false, version: null }));
    proc.on("close", () => {
      const trimmed = output.trim();
      resolve({
        found: trimmed.length > 0,
        version: trimmed.length > 0 ? trimmed.split(/\r?\n/)[0] : null,
      });
    });
  });
}

/**
 * Locate yt-dlp binary.
 * Inside Docker it is always installed at the system level via pip.
 */
async function findYtDlp() {
  const result = await checkCommand("yt-dlp", ["--version"]);
  return {
    found: result.found,
    command: result.found ? "yt-dlp" : null,
    version: result.version,
  };
}

/**
 * Locate ffmpeg binary.
 */
async function findFfmpeg() {
  const result = await checkCommand("ffmpeg", ["-version"]);
  return { found: result.found, version: result.version };
}

module.exports = { findYtDlp, findFfmpeg };
