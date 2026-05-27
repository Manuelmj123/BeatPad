import React from "react";
import Sidebar        from "./Sidebar.jsx";
import SongWorkspace  from "./SongWorkspace.jsx";
import AlbumsLibrary  from "./AlbumsLibrary.jsx";
import AlbumDetail    from "./AlbumDetail.jsx";
import EmptyState     from "./EmptyState.jsx";
import HealthStatus   from "./HealthStatus.jsx";

export default function AppShell({
  songs,
  selectedId,
  selectedSong,
  songLoading,
  health,
  healthLoading,
  mainView,
  selectedAlbumId,
  onSelectSong,
  onNewSong,
  onDeleteSong,
  onRefreshSong,
  onPatchSong,
  onGoHome,
  onGoToAlbum,
  onNewSongInAlbum,
  showToast,
  onExport,
  onSettings,
  onPlayTrack,
  // Pin feature props
  pinnedSongIds,
  pinnedAlbums,
  onTogglePinSong,
  onTogglePinAlbum,
  // Song color props
  songColors,
  onSetSongColor,
  // Album color props
  albumColors,
  onSetAlbumColor,
}) {
  return (
    <div className="shell">
      {/* Decorative background blobs */}
      <div className="blob blob--1" aria-hidden="true" />
      <div className="blob blob--2" aria-hidden="true" />

      {/* Top status bar */}
      <div className="shell__topbar">
        <HealthStatus health={health} loading={healthLoading} />
      </div>

      {/* Main layout */}
      <div className="shell__body">
        <Sidebar
          songs={songs}
          selectedId={selectedId}
          mainView={mainView}
          onSelect={onSelectSong}
          onNew={onNewSong}
          onDelete={onDeleteSong}
          onSettings={onSettings}
          onGoHome={onGoHome}
          onGoToAlbum={onGoToAlbum}
          pinnedSongIds={pinnedSongIds}
          pinnedAlbums={pinnedAlbums}
          onTogglePinSong={onTogglePinSong}
          onTogglePinAlbum={onTogglePinAlbum}
          songColors={songColors}
          onSetSongColor={onSetSongColor}
        />

        <main className="shell__main">
          {/* ── Library home ──────────────────────────────────────────────── */}
          {mainView === "home" && (
            <AlbumsLibrary
              onSelectAlbum={onGoToAlbum}
              onSelectSong={onSelectSong}
              showToast={showToast}
              pinnedAlbums={pinnedAlbums}
              onTogglePinAlbum={onTogglePinAlbum}
              albumColors={albumColors}
              onSetAlbumColor={onSetAlbumColor}
            />
          )}

          {/* ── Album detail ──────────────────────────────────────────────── */}
          {mainView === "album" && selectedAlbumId && (
            <AlbumDetail
              albumId={selectedAlbumId}
              onBack={onGoHome}
              onSelectSong={onSelectSong}
              onCreateSong={onNewSongInAlbum}
              showToast={showToast}
              albumColor={albumColors?.[String(selectedAlbumId)]}
              onSetAlbumColor={onSetAlbumColor}
            />
          )}

          {/* ── Song workspace ────────────────────────────────────────────── */}
          {mainView === "song" && (selectedId || songLoading) && (
            <SongWorkspace
              song={selectedSong}
              loading={songLoading}
              onRefresh={onRefreshSong}
              onPatchSong={onPatchSong}
              showToast={showToast}
              onExport={onExport}
              onPlayTrack={onPlayTrack}
              songColors={songColors}
              onSetSongColor={onSetSongColor}
            />
          )}
        </main>
      </div>
    </div>
  );
}
