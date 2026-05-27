import React, { useEffect, useRef, useState } from "react";
import { browseFolder, makeFolder } from "../api.js";

function IconFolder({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open
        ? <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h4l2-2h6a2 2 0 012 2v1M2 10h20"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * FolderBrowser — popup folder picker with full filesystem navigation.
 *
 * Now allows browsing the entire filesystem (not just the Docker volume roots).
 * Users can navigate up to / and explore any accessible directory.
 *
 * Props:
 *   rootPath   {string}   Initial path to start from
 *   onSelect   {fn}       Called with the chosen absolute path
 *   onClose    {fn}       Called when dismissed without selecting
 */
export default function FolderBrowser({ rootPath, onSelect, onClose }) {
  const [current,    setCurrent]    = useState(rootPath || "/");
  const [dirs,       setDirs]       = useState([]);
  const [fsRoot,     setFsRoot]     = useState("/");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [newName,    setNewName]    = useState("");
  const [creating,   setCreating]   = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft,  setPathDraft]  = useState("");
  const pathInputRef = useRef(null);

  // Fetch directory listing whenever `current` changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    browseFolder(current)
      .then(({ dirs: d, base: b }) => {
        if (cancelled) return;
        setDirs(d);
        setFsRoot(b || "/");
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [current]);

  // Focus path input when editing
  useEffect(() => {
    if (editingPath) {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    }
  }, [editingPath]);

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && !editingPath) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, editingPath]);

  function goInto(dirName) {
    const sep = current.endsWith("/") ? "" : "/";
    setCurrent(current + sep + dirName);
    setShowNew(false);
    setNewName("");
  }

  function goUp() {
    // Navigate up one directory
    const parent = current.includes("/")
      ? current.substring(0, current.lastIndexOf("/")) || "/"
      : current;
    if (parent !== current) {
      setCurrent(parent);
      setShowNew(false);
      setNewName("");
    }
  }

  function goHome() {
    setCurrent(rootPath || "/");
    setShowNew(false);
    setNewName("");
  }

  function startEditPath() {
    setPathDraft(current);
    setEditingPath(true);
  }

  function commitPathEdit() {
    const trimmed = pathDraft.trim();
    if (trimmed && trimmed !== current) {
      setCurrent(trimmed);
    }
    setEditingPath(false);
  }

  async function handleCreate() {
    const trimmed = newName.trim().replace(/[/\\]/g, ""); // strip slashes
    if (!trimmed) return;
    setCreating(true);
    try {
      const sep = current.endsWith("/") ? "" : "/";
      await makeFolder(`${current}${sep}${trimmed}`);
      setNewName("");
      setShowNew(false);
      // Refresh listing
      const { dirs: d } = await browseFolder(current);
      setDirs(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const canGoUp = current !== fsRoot && current !== "/";

  return (
    <div className="fb-backdrop" onClick={onClose}>
      <div className="fb" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Browse folders">

        {/* Header */}
        <div className="fb__header">
          <button
            className="fb__back"
            onClick={goUp}
            disabled={!canGoUp}
            title="Go up one level"
          >
            <IconBack />
          </button>

          {/* Breadcrumb / path display — click to edit */}
          <div className="fb__breadcrumb-area">
            {editingPath ? (
              <input
                ref={pathInputRef}
                className="fb__path-input"
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitPathEdit();
                  if (e.key === "Escape") setEditingPath(false);
                }}
                onBlur={commitPathEdit}
              />
            ) : (
              <button className="fb__breadcrumb" title="Click to type a path" onClick={startEditPath}>
                <span className="fb__breadcrumb-text">{current}</span>
                <span className="fb__breadcrumb-edit"><IconEdit /></span>
              </button>
            )}
          </div>

          {/* Home button — back to original rootPath */}
          <button
            className="fb__home"
            onClick={goHome}
            title="Back to default path"
          >
            <IconHome />
          </button>

          <button className="fb__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Directory list */}
        <div className="fb__list">
          {loading && (
            <div className="fb__empty">
              <svg className="fb__spinner" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
                <path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          )}

          {!loading && error && (
            <div className="fb__empty fb__empty--error">
              <span>⚠ {error}</span>
            </div>
          )}

          {!loading && !error && dirs.length === 0 && (
            <div className="fb__empty">No subfolders — create one below</div>
          )}

          {!loading && !error && dirs.map((d) => (
            <button key={d} className="fb__item" onClick={() => goInto(d)}>
              <span className="fb__item-icon"><IconFolder open={false} /></span>
              <span className="fb__item-name">{d}</span>
              <span className="fb__item-arrow">›</span>
            </button>
          ))}
        </div>

        {/* New folder inline form */}
        {showNew ? (
          <div className="fb__new-form">
            <input
              className="fb__new-input"
              placeholder="New folder name…"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setShowNew(false); setNewName(""); }
              }}
            />
            <button
              className="btn btn--accent btn--sm"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "…" : "Create"}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setShowNew(false); setNewName(""); }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="fb__new-btn" onClick={() => setShowNew(true)}>
            <IconPlus /> New subfolder
          </button>
        )}

        {/* Footer */}
        <div className="fb__footer">
          <span className="fb__footer-path" title={current}>{current}</span>
          <button className="btn btn--grad btn--sm" onClick={() => onSelect(current)}>
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}
