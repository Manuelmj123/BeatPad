const path = require("path");

/**
 * Remove characters that are illegal in file names, collapse whitespace to
 * hyphens, and cap the result at 200 characters.
 *
 * Strips: < > : " / \ | ? *  and ASCII control characters (0x00–0x1f).
 *
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") return "file";

  // Remove illegal characters and control characters
  let clean = filename
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/[\x00-\x1f]/g, ""); // eslint-disable-line no-control-regex

  // Collapse runs of whitespace (spaces, tabs, etc.) to a single hyphen
  clean = clean.replace(/\s+/g, "-");

  // Remove leading/trailing hyphens and dots
  clean = clean.replace(/^[-.\s]+|[-.\s]+$/g, "");

  // Cap length
  if (clean.length > 200) {
    clean = clean.slice(0, 200);
  }

  return clean || "file";
}

/**
 * Build a stored file name from an original name.
 * Format: <sanitized-base>-<YYYYMMDD-HHmmss><ext>
 *
 * @param {string} originalName  e.g. "My Final Mix.wav"
 * @returns {string}             e.g. "My-Final-Mix-20240115-143022.wav"
 */
function buildStoredFilename(originalName) {
  const ext       = path.extname(originalName || "");
  const baseName  = path.basename(originalName || "file", ext);
  const sanitized = sanitizeFilename(baseName);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  return `${sanitized}-${timestamp}${ext.toLowerCase()}`;
}

/**
 * Check that targetPath is inside baseDir (path traversal guard).
 * Returns true only if path.resolve(targetPath) starts with path.resolve(baseDir).
 *
 * @param {string} baseDir
 * @param {string} targetPath
 * @returns {boolean}
 */
function isSafePath(baseDir, targetPath) {
  const resolvedBase   = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget.startsWith(resolvedBase + path.sep) ||
    resolvedTarget === resolvedBase
  );
}

module.exports = { sanitizeFilename, buildStoredFilename, isSafePath };
