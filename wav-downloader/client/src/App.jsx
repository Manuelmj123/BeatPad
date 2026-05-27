import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHealth, fetchSongs, fetchSong, createSong, deleteSong,
  addSongsToAlbum,
} from "./api.js";
import AppShell        from "./components/AppShell.jsx";
import NewSongModal    from "./components/NewSongModal.jsx";
import ExportSongModal from "./components/ExportSongModal.jsx";
import SettingsModal   from "./components/SettingsModal.jsx";
import MusicPlayer     from "./components/MusicPlayer.jsx";
import Toast           from "./components/Toast.jsx";

export default function App() {
  const [songs,          setSongs]          = useState([]);
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedSong,   setSelectedSong]   = useState(null);
  const [health,         setHealth]         = useState(null);
  const [healthLoading,  setHealthLoading]  = useState(true);
  const [showNewSong,    setShowNewSong]    = useState(false);
  const [songLoading,    setSongLoading]    = useState(false);
  const [toast,          setToast]          = useState(null);

  // ── View routing ──────────────────────────────────────────────────────────
  // 'home' = library/albums page, 'song' = workspace, 'album' = album detail
  const [mainView,         setMainView]         = useState("home");
  const [selectedAlbumId,  setSelectedAlbumId]  = useState(null);
  // When creating a song from inside an album, auto-add it after creation
  const [pendingAlbumId,   setPendingAlbumId]   = useState(null);

  // ── Music player ──────────────────────────────────────────────────────────
  // Kept at app level so the player persists when navigating between views.
  const [playerTrack, setPlayerTrack] = useState(null); // { url, name, type }

  // ── Pinned songs (Set of string IDs, persisted to localStorage) ───────────
  const [pinnedSongIds, setPinnedSongIds] = useState(() => {
    try {
      const saved = localStorage.getItem("pinnedSongIds");
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });

  // ── Pinned albums ([{id, name}], persisted to localStorage) ──────────────
  const [pinnedAlbums, setPinnedAlbums] = useState(() => {
    try {
      const saved = localStorage.getItem("pinnedAlbums");
      return Array.isArray(JSON.parse(saved)) ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSongId,    setExportSongId]    = useState(null);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  const toastTimer = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((message, type = "info") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Health ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false));
  }, []);

  // ── Songs ─────────────────────────────────────────────────────────────────

  const loadSongs = useCallback(async () => {
    try {
      const data = await fetchSongs();
      setSongs(data.songs ?? []);
    } catch {
      setSongs([]);
    }
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goHome = useCallback(() => {
    setMainView("home");
    setSelectedAlbumId(null);
    setSelectedId(null);
    setSelectedSong(null);
  }, []);

  const goToAlbum = useCallback((albumId) => {
    setMainView("album");
    setSelectedAlbumId(albumId);
    setSelectedId(null);
    setSelectedSong(null);
  }, []);

  // ── Select / load song ────────────────────────────────────────────────────

  const selectSong = useCallback(async (id) => {
    if (id === selectedId && mainView === "song") return;
    // Reset player only when actually switching to a different song
    if (id !== selectedId) setPlayerTrack(null);
    setSelectedId(id);
    setSelectedSong(null);
    setSongLoading(true);
    setMainView("song");
    setSelectedAlbumId(null);
    try {
      const data = await fetchSong(id);
      setSelectedSong(data.song);
    } catch {
      showToast("Could not load song.", "error");
    } finally {
      setSongLoading(false);
    }
  }, [selectedId, mainView, showToast]);

  const refreshSelectedSong = useCallback(async (forcedId) => {
    const id = forcedId ?? selectedId;
    if (!id) return;
    try {
      const data = await fetchSong(id);
      setSelectedSong(data.song);
      await loadSongs();
    } catch { /* silent */ }
  }, [selectedId, loadSongs]);

  const patchSelectedSong = useCallback((patch) => {
    setSelectedSong((s) => s ? { ...s, ...patch } : s);
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s))
    );
  }, [selectedId]);

  // ── Create song ───────────────────────────────────────────────────────────

  const handleCreateSong = useCallback(async (formData) => {
    try {
      const data    = await createSong(formData);
      const newSong = data.song;
      setShowNewSong(false);
      await loadSongs();

      // If created from inside an album, add it there
      const albumId = pendingAlbumId;
      setPendingAlbumId(null);
      if (albumId) {
        try { await addSongsToAlbum(albumId, [newSong.id]); } catch { /* ignore */ }
      }

      await selectSong(newSong.id);
      showToast(`"${newSong.title}" created`, "success");
      return newSong;
    } catch (err) {
      showToast(err.message || "Could not create song.", "error");
      throw err;
    }
  }, [loadSongs, selectSong, showToast, pendingAlbumId]);

  // Triggered from AlbumDetail — open NewSongModal with album context
  const handleNewSongInAlbum = useCallback((albumId) => {
    setPendingAlbumId(albumId);
    setShowNewSong(true);
  }, []);

  // ── Delete song ───────────────────────────────────────────────────────────

  const handleDeleteSong = useCallback(async (id) => {
    const song = songs.find((s) => s.id === id);
    const name = song?.title || "this song";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteSong(id);
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedSong(null);
        setMainView("home");
        setPlayerTrack(null); // stop player for deleted song
      }
      await loadSongs();
      showToast("Song deleted.", "info");
    } catch (err) {
      showToast(err.message || "Could not delete song.", "error");
    }
  }, [songs, selectedId, loadSongs, showToast]);

  // ── Song colors ({ [id]: hexString }, persisted to localStorage) ─────────

  const [songColors, setSongColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem("songColors") || "{}"); }
    catch { return {}; }
  });

  const setSongColor = useCallback((id, color) => {
    setSongColors((prev) => {
      const next = { ...prev, [String(id)]: color };
      try { localStorage.setItem("songColors", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Album colors ({ [id]: hexString }, persisted to localStorage) ─────────

  const [albumColors, setAlbumColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem("albumColors") || "{}"); }
    catch { return {}; }
  });

  const setAlbumColor = useCallback((id, color) => {
    setAlbumColors((prev) => {
      const next = { ...prev, [String(id)]: color };
      try { localStorage.setItem("albumColors", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Pin songs ─────────────────────────────────────────────────────────────

  const togglePinSong = useCallback((id) => {
    setPinnedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      try { localStorage.setItem("pinnedSongIds", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Pin albums ────────────────────────────────────────────────────────────

  const togglePinAlbum = useCallback((album) => {
    setPinnedAlbums((prev) => {
      const exists = prev.some((a) => String(a.id) === String(album.id));
      const next   = exists
        ? prev.filter((a) => String(a.id) !== String(album.id))
        : [...prev, { id: album.id, name: album.name }];
      try { localStorage.setItem("pinnedAlbums", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleOpenExport = useCallback((songId) => {
    setExportSongId(songId);
    setShowExportModal(true);
  }, []);

  const handleCloseExport = useCallback(() => {
    setShowExportModal(false);
    setExportSongId(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AppShell
        songs={songs}
        selectedId={selectedId}
        selectedSong={selectedSong}
        songLoading={songLoading}
        health={health}
        healthLoading={healthLoading}
        mainView={mainView}
        selectedAlbumId={selectedAlbumId}
        onSelectSong={selectSong}
        onNewSong={() => setShowNewSong(true)}
        onDeleteSong={handleDeleteSong}
        onRefreshSong={refreshSelectedSong}
        onPatchSong={patchSelectedSong}
        onGoHome={goHome}
        onGoToAlbum={goToAlbum}
        onNewSongInAlbum={handleNewSongInAlbum}
        showToast={showToast}
        onExport={handleOpenExport}
        onSettings={() => setShowSettings(true)}
        onPlayTrack={setPlayerTrack}
        pinnedSongIds={pinnedSongIds}
        pinnedAlbums={pinnedAlbums}
        onTogglePinSong={togglePinSong}
        onTogglePinAlbum={togglePinAlbum}
        songColors={songColors}
        onSetSongColor={setSongColor}
        albumColors={albumColors}
        onSetAlbumColor={setAlbumColor}
      />

      {showNewSong && (
        <NewSongModal
          onClose={() => { setShowNewSong(false); setPendingAlbumId(null); }}
          onCreate={handleCreateSong}
          onRefreshSong={refreshSelectedSong}
          showToast={showToast}
          onSetSongColor={setSongColor}
        />
      )}

      {showExportModal && exportSongId && (
        <ExportSongModal
          songId={exportSongId}
          songTitle={selectedSong?.title || "Song"}
          onClose={handleCloseExport}
          showToast={showToast}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          showToast={showToast}
        />
      )}

      {/* ── Persistent music player — survives page navigation ── */}
      <MusicPlayer
        track={playerTrack}
        onClose={() => setPlayerTrack(null)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
