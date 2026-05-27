/**
 * BeatPad API client.
 * All paths are relative (/api/...) and routed through Vite's proxy to the backend.
 */

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export const fetchHealth = () => request("/health");

// ─── Songs ───────────────────────────────────────────────────────────────────

export const fetchSongs  = ()         => request("/songs");
export const fetchSong   = (id)       => request(`/songs/${id}`);
export const createSong  = (data)     => request("/songs", { method: "POST", body: JSON.stringify(data) });
export const updateSong  = (id, data) => request(`/songs/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteSong  = (id)       => request(`/songs/${id}`, { method: "DELETE" });

export const saveLyricVersion = (id, lyrics, versionLabel) =>
  request(`/songs/${id}/versions`, {
    method: "POST",
    body: JSON.stringify({ lyrics, version_label: versionLabel }),
  });

// ─── Beat Download ───────────────────────────────────────────────────────────

/**
 * Start a beat download job. Returns { jobId }.
 */
export const startBeatDownload = (songId, url) =>
  request(`/songs/${songId}/download-beat`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

/**
 * Open a Server-Sent Events stream for a download job.
 * Returns a cleanup function that closes the EventSource.
 *
 * @param {string} jobId
 * @param {{ onLine, onComplete, onError }} callbacks
 */
export function openDownloadJobStream(jobId, { onLine, onComplete, onError }) {
  const es = new EventSource(`/api/download-jobs/${encodeURIComponent(jobId)}/events`);

  es.onmessage = (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }

    if (payload.type === "output") {
      onLine(payload.line);
    } else if (payload.type === "complete") {
      es.close();
      onComplete(payload);
    }
  };

  es.onerror = () => {
    es.close();
    onError(new Error("Connection to server lost. Is the backend running?"));
  };

  return () => es.close();
}

/**
 * Build the URL that streams the WAV file for download.
 */
export const getBeatDownloadUrl = (beatId) => `/api/beats/${beatId}/download`;

/**
 * Build the URL that streams the WAV for in-browser audio playback.
 */
export const getBeatStreamUrl = (beatId) => `/api/beats/${beatId}/stream`;

/**
 * Detach (remove from DB) a beat record. File on disk is kept.
 */
export const detachBeat = (beatId) =>
  request(`/beats/${beatId}`, { method: "DELETE" });

/**
 * Upload a local audio file as the beat for a song.
 * Accepts WAV, MP3, FLAC, AAC, M4A, OGG (up to 500 MB).
 */
export async function uploadBeat(songId, file) {
  const fd = new FormData();
  fd.append("beat", file);
  const res  = await fetch(`/api/songs/${songId}/upload-beat`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Ask the server to open the beat's folder in the host OS file explorer.
 */
export const openBeatFolder = (beatId) =>
  request(`/beats/${beatId}/open-folder`, { method: "POST" });

/**
 * Ask the server to open the completed song's folder in the host OS file explorer.
 */
export const openCompletedSongFolder = (id) =>
  request(`/completed-songs/${id}/open-folder`, { method: "POST" });

// ─── Completed Songs ──────────────────────────────────────────────────────────

/**
 * Upload a completed song file with metadata.
 * Uses FormData — does NOT set Content-Type manually so the browser sets the
 * correct multipart/form-data boundary automatically.
 *
 * @param {number} songId
 * @param {FormData} formData  Must include a "file" field
 * @returns {Promise<object>}
 */
export async function uploadCompletedSong(songId, formData) {
  const res = await fetch(`/api/songs/${songId}/completed-song`, {
    method: "POST",
    body:   formData,
    // Do NOT set Content-Type header — let the browser set multipart boundary
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

export const getCompletedSongs = (songId) =>
  request(`/songs/${songId}/completed-songs`);

export const updateCompletedSong = (id, data) =>
  request(`/completed-songs/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(data),
  });

export const deleteCompletedSong = (id) =>
  request(`/completed-songs/${id}`, { method: "DELETE" });

/**
 * Returns the URL to trigger a file download for a completed song.
 */
export const getCompletedSongDownloadUrl = (id) => `/api/completed-songs/${id}/download`;

/**
 * Returns the URL to stream a completed song for the audio player.
 */
export const getCompletedSongStreamUrl = (id) => `/api/completed-songs/${id}/stream`;

// ─── Albums ───────────────────────────────────────────────────────────────────

export const fetchSongAlbums      = (songId)  => request(`/songs/${songId}/albums`);

export const fetchAlbums          = ()        => request("/albums");
export const fetchAlbum           = (id)      => request(`/albums/${id}`);
export const createAlbum          = (data)    => request("/albums", { method: "POST", body: JSON.stringify(data) });
export const updateAlbum          = (id, data)=> request(`/albums/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteAlbum          = (id)      => request(`/albums/${id}`, { method: "DELETE" });
export const fetchUnassignedSongs = ()        => request("/albums/unassigned");

export const addSongsToAlbum = (albumId, songIds) =>
  request(`/albums/${albumId}/songs`, { method: "POST", body: JSON.stringify({ songIds }) });

export const removeSongFromAlbum = (albumId, songId) =>
  request(`/albums/${albumId}/songs/${songId}`, { method: "DELETE" });

/**
 * Returns the URL that streams the album cover image.
 * Append a cache-buster timestamp to force refresh after re-upload.
 */
export const getAlbumCoverUrl = (albumId, ts = "") =>
  `/api/albums/${albumId}/cover${ts ? `?t=${ts}` : ""}`;

/**
 * Upload an image file as the album's cover art.
 */
export async function uploadAlbumCover(albumId, file) {
  const fd = new FormData();
  fd.append("cover", file);
  const res  = await fetch(`/api/albums/${albumId}/cover`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export const fetchSettings  = ()       => request("/settings");
export const updateSettings = (data)   => request("/settings", {
  method: "PATCH",
  body: JSON.stringify(data),
});
export const resetSetting   = (key)    => request(`/settings/${encodeURIComponent(key)}/reset`, {
  method: "POST",
});
export const browseFolder   = (p)      => request(`/settings/browse?path=${encodeURIComponent(p)}`);
export const makeFolder     = (p)      => request("/settings/mkdir", {
  method: "POST",
  body: JSON.stringify({ path: p }),
});

// ─── Export ───────────────────────────────────────────────────────────────────

export const getSongExportPreview  = (id) => request(`/songs/${id}/export-preview`);
export const getSongPackagePreview = (id) => request(`/songs/${id}/export-package-preview`);

export const saveSongPackage = (id) =>
  fetch(`/api/songs/${id}/export-package/save`, { method: "POST" }).then((r) => r.json());

/**
 * Fetch the ZIP package and trigger a browser download.
 */
export async function downloadSongPackage(songId, songTitle) {
  const res = await fetch(`/api/songs/${songId}/export-package`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const safeTitle = (songTitle || "song")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  a.href     = url;
  a.download = `${safeTitle}-package.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fetch the TXT export and trigger a browser download.
 */
export async function downloadSongExportTxt(songId, songTitle) {
  const res = await fetch(`/api/songs/${songId}/export-txt`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const safeTitle = (songTitle || "song")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  a.href     = url;
  a.download = `${safeTitle}-lyrics.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
