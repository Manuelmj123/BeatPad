const fs = require("fs");

// Pull from the shared settings cache (which falls back to env vars)
const settingsService = require("./settingsService");

function getDownloadsPath() { return settingsService.getDownloadsPath(); }
function getUploadsPath()   { return settingsService.getUploadsPath(); }
function getExportsPath()   { return settingsService.getExportsPath(); }

/**
 * Get file size in bytes, or null if the file cannot be statted.
 */
function getFileSizeBytes(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

/**
 * Convert a container-internal file path to a host-relative path string.
 * E.g. "/downloads/my beat.wav"  → "./downloads/my beat.wav"
 *      "/uploads/my-mix.wav"     → "./uploads/my-mix.wav"
 *      "/exports/package.zip"    → "./exports/package.zip"
 *
 * This is informational only; it tells the user where to find the file
 * in the project folder on their host machine.
 */
function containerPathToHostRelative(containerPath) {
  if (!containerPath) return containerPath;

  const downloadsDir = getDownloadsPath(); // e.g. "/downloads"
  const uploadsDir   = getUploadsPath();   // e.g. "/uploads"
  const exportsDir   = getExportsPath();   // e.g. "/exports"

  if (containerPath.startsWith(downloadsDir)) {
    const rest = containerPath.slice(downloadsDir.length);
    return `./downloads${rest}`;
  }
  if (containerPath.startsWith(uploadsDir)) {
    const rest = containerPath.slice(uploadsDir.length);
    return `./uploads${rest}`;
  }
  if (containerPath.startsWith(exportsDir)) {
    const rest = containerPath.slice(exportsDir.length);
    return `./exports${rest}`;
  }

  return containerPath;
}

/**
 * Check if the downloads directory is writable.
 */
function isDownloadsWritable() {
  try {
    fs.accessSync(getDownloadsPath(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the uploads directory is writable.
 */
function isUploadsWritable() {
  try {
    fs.accessSync(getUploadsPath(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the exports directory is writable.
 */
function isExportsWritable() {
  try {
    fs.accessSync(getExportsPath(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getFileSizeBytes,
  containerPathToHostRelative,
  isDownloadsWritable,
  isUploadsWritable,
  isExportsWritable,
  getUploadsPath,
  getExportsPath,
};
