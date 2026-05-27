const VALID_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);

/**
 * Validate a YouTube URL.
 * @param {unknown} url
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, reason: "URL is required and must be a string." };
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { valid: false, reason: "URL must start with http:// or https://" };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "The URL is malformed." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!VALID_YOUTUBE_HOSTS.has(hostname)) {
    return {
      valid: false,
      reason:
        "URL must be from YouTube (youtube.com, youtu.be, music.youtube.com, youtube-nocookie.com).",
    };
  }

  return { valid: true };
}

/**
 * Parse and validate an integer ID from a route parameter.
 * @param {string|undefined} raw
 * @returns {number|null}
 */
function validateId(raw) {
  const n = parseInt(raw, 10);
  return !isNaN(n) && n > 0 ? n : null;
}

/**
 * Extract YouTube video ID from a URL string.
 * Returns null if not found.
 */
function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1) || null;
    }
    return parsed.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

module.exports = { validateYouTubeUrl, validateId, extractVideoId };
