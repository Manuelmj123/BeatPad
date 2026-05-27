import React, { useEffect, useRef, useState } from "react";
import { updateSong, saveLyricVersion } from "../api.js";
import AutosaveIndicator from "./AutosaveIndicator.jsx";

const SNIPPET_VERSE  = "\n[Verse]\n";
const SNIPPET_HOOK   = "\n[Hook]\n";
const SNIPPET_BRIDGE = "\n[Bridge]\n";

const ZOOM_STEPS   = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75, 2];
const ZOOM_DEFAULT = 2; // index → 1.0

const MAX_HISTORY = 150;

function IconUndo({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconRedo({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 7v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * Medium-style lyrics editor with zoom, debounced autosave, snippet shortcuts,
 * and full undo/redo history.
 *
 * Props:
 *   song       — full song object
 *   onPatch    — (patch) => void
 *   showToast  — (msg, type) => void
 */
export default function LyricsEditor({ song, onPatch, showToast }) {
  const [lyrics,     setLyrics]     = useState(song.lyrics || "");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [copyDone,   setCopyDone]   = useState(false);
  const [zoomIdx,    setZoomIdx]    = useState(ZOOM_DEFAULT);
  const [canUndo,    setCanUndo]    = useState(false);
  const [canRedo,    setCanRedo]    = useState(false);

  const textareaRef = useRef(null);
  const saveTimer   = useRef(null);
  const prevSongId  = useRef(song.id);

  // ── Undo/redo history ──────────────────────────────────────────────────────
  // histRef holds the snapshots; histPosRef is the current cursor within them.
  const histRef    = useRef([song.lyrics || ""]);
  const histPosRef = useRef(0);

  const zoomScale = ZOOM_STEPS[zoomIdx];

  // ── Reset when a different song is selected ──────────────────────────────
  useEffect(() => {
    if (song.id !== prevSongId.current) {
      prevSongId.current = song.id;
      const initial = song.lyrics || "";
      setLyrics(initial);
      setSaveStatus("idle");
      histRef.current    = [initial];
      histPosRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [song.id, song.lyrics]);

  // No auto-resize — textarea fills its container via flex; content scrolls internally.

  // ── Debounced autosave (700 ms) ───────────────────────────────────────────
  useEffect(() => {
    if (lyrics === (song.lyrics || "")) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("modified");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await updateSong(song.id, { lyrics });
        onPatch({ lyrics });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [lyrics, song.id, song.lyrics, onPatch]);

  // ── History helpers ───────────────────────────────────────────────────────
  function pushHistory(val) {
    // Trim any "future" after current position, then push
    const trimmed = histRef.current.slice(0, histPosRef.current + 1);
    trimmed.push(val);
    // Enforce max size
    if (trimmed.length > MAX_HISTORY) trimmed.splice(0, trimmed.length - MAX_HISTORY);
    histRef.current    = trimmed;
    histPosRef.current = trimmed.length - 1;
    setCanUndo(histPosRef.current > 0);
    setCanRedo(false);
  }

  // ── onChange — only fires for actual user keystrokes ─────────────────────
  function handleChange(e) {
    const val = e.target.value;
    pushHistory(val);
    setLyrics(val);
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  function undo() {
    if (histPosRef.current <= 0) return;
    histPosRef.current--;
    const val = histRef.current[histPosRef.current];
    setLyrics(val);
    setCanUndo(histPosRef.current > 0);
    setCanRedo(true);
  }

  function redo() {
    if (histPosRef.current >= histRef.current.length - 1) return;
    histPosRef.current++;
    const val = histRef.current[histPosRef.current];
    setLyrics(val);
    setCanUndo(true);
    setCanRedo(histPosRef.current < histRef.current.length - 1);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  function handleKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    if (mod && e.key === "y") {
      e.preventDefault();
      redo();
    }
  }

  // ── Snippet insertion (also tracked in history) ───────────────────────────
  function insertSnippet(text) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = lyrics.slice(0, start) + text + lyrics.slice(end);
    pushHistory(next);
    setLyrics(next);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  }

  // ── Save explicit version snapshot ────────────────────────────────────────
  async function handleSaveVersion() {
    if (!lyrics.trim()) return showToast("Nothing to save yet.", "warning");
    try {
      const label = `v${new Date().toLocaleTimeString()}`;
      await saveLyricVersion(song.id, lyrics, label);
      showToast(`Version saved: ${label}`, "success");
    } catch {
      showToast("Could not save version.", "error");
    }
  }

  // ── Copy lyrics to clipboard ──────────────────────────────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(lyrics);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      showToast("Clipboard not available.", "warning");
    }
  }

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  function zoomIn()    { setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1)); }
  function zoomOut()   { setZoomIdx((i) => Math.max(i - 1, 0)); }
  function zoomReset() { setZoomIdx(ZOOM_DEFAULT); }

  const wordCount = lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0;
  const charCount = lyrics.length;

  return (
    <div className="lyrics-editor">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="lyrics-editor__toolbar">
        {/* Snippet buttons */}
        <div className="lyrics-editor__snippets">
          <button className="snippet-btn" onClick={() => insertSnippet(SNIPPET_HOOK)}>
            + Hook
          </button>
          <button className="snippet-btn" onClick={() => insertSnippet(SNIPPET_VERSE)}>
            + Verse
          </button>
          <button className="snippet-btn" onClick={() => insertSnippet(SNIPPET_BRIDGE)}>
            + Bridge
          </button>
        </div>

        {/* Right-side actions */}
        <div className="lyrics-editor__actions">
          <AutosaveIndicator status={saveStatus} />

          {/* Undo / Redo */}
          <div className="undo-redo-group" role="group" aria-label="Undo and redo">
            <button
              className="undo-redo-btn"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <IconUndo />
            </button>
            <button
              className="undo-redo-btn"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <IconRedo />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="zoom-controls" role="group" aria-label="Text zoom">
            <button
              className="zoom-btn"
              onClick={zoomOut}
              disabled={zoomIdx === 0}
              title="Zoom out"
              aria-label="Decrease text size"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8"  y1="11" x2="14"    y2="11"    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              className="zoom-btn zoom-btn--label"
              onClick={zoomReset}
              title="Reset zoom"
              aria-label="Reset text size"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              className="zoom-btn"
              onClick={zoomIn}
              disabled={zoomIdx === ZOOM_STEPS.length - 1}
              title="Zoom in"
              aria-label="Increase text size"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="11" y1="8"  x2="11"    y2="14"    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8"  y1="11" x2="14"    y2="11"    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <button className="icon-btn" onClick={handleCopy} title="Copy lyrics">
            {copyDone ? "✓ Copied" : "📋 Copy"}
          </button>
          <button className="icon-btn icon-btn--accent" onClick={handleSaveVersion} title="Save version snapshot">
            💾 Save Version
          </button>
        </div>
      </div>

      {/* ── Writing area ────────────────────────────────────────────────────── */}
      <div className="lyrics-editor__writing-area">
        <textarea
          ref={textareaRef}
          className="lyrics-editor__area"
          style={{ fontSize: `${zoomScale}rem` }}
          placeholder={`Start writing your lyrics…\n\n[Hook]\n\n[Verse 1]\n\n[Bridge]`}
          value={lyrics}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck
        />
      </div>

      {/* ── Footer meta ─────────────────────────────────────────────────────── */}
      <div className="lyrics-editor__footer">
        <span className="lyrics-editor__meta">
          {wordCount > 0
            ? `${wordCount.toLocaleString()} words · ${charCount.toLocaleString()} characters`
            : "Start writing…"
          }
        </span>
        {(canUndo || canRedo) && (
          <span className="lyrics-editor__hist-hint">
            History: {histPosRef.current + 1} / {histRef.current.length}
          </span>
        )}
      </div>
    </div>
  );
}
