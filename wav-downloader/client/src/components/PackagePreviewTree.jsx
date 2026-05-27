import React from "react";

/**
 * Renders the ZIP package contents as a visual file tree.
 *
 * Props:
 *   preview — { song, filesIncluded: [{type, fileName, exists, hostRelativePath}], warnings }
 */
export default function PackagePreviewTree({ preview }) {
  if (!preview) {
    return <div className="pkg-tree pkg-tree--empty">No preview data.</div>;
  }

  const { song, filesIncluded = [], warnings = [] } = preview;

  // Group files into top-level and folder children
  const topLevel = filesIncluded.filter((f) => !f.fileName.includes("/"));
  const beatsFiles     = filesIncluded.filter((f) => f.fileName.startsWith("beats/"));
  const completedFiles = filesIncluded.filter((f) => f.fileName.startsWith("completed-songs/"));

  function FileRow({ file, indent = 0 }) {
    const baseName = file.fileName.includes("/")
      ? file.fileName.slice(file.fileName.lastIndexOf("/") + 1)
      : file.fileName;

    const icon =
      file.type === "beat"           ? "🎵" :
      file.type === "completed-song" ? "🎵" :
      file.type === "json"           ? "📋" :
                                       "📄";

    return (
      <div className="pkg-tree__item" style={{ paddingLeft: `${indent * 16 + 8}px` }}>
        <span className="pkg-tree__icon">{icon}</span>
        <span className="pkg-tree__name">{baseName}</span>
        {file.hostRelativePath && (
          <span className="pkg-tree__path" title={file.hostRelativePath}>
            {file.hostRelativePath}
          </span>
        )}
        {file.exists !== false ? (
          <span className="pkg-tree__badge pkg-tree__badge--ok" title="File found">✓</span>
        ) : (
          <span className="pkg-tree__badge pkg-tree__badge--warn" title="File not found on disk">⚠</span>
        )}
      </div>
    );
  }

  function FolderRow({ name, children, indent = 1 }) {
    if (children.length === 0) return null;
    return (
      <>
        <div className="pkg-tree__item pkg-tree__item--folder" style={{ paddingLeft: `${(indent - 1) * 16 + 8}px` }}>
          <span className="pkg-tree__icon">📁</span>
          <span className="pkg-tree__name">{name}/</span>
        </div>
        {children.map((f, i) => (
          <FileRow key={i} file={f} indent={indent} />
        ))}
      </>
    );
  }

  const songTitle = song?.title || "Song";
  const safeTitle = songTitle.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "-").slice(0, 40);

  return (
    <div className="pkg-tree">
      {/* Root */}
      <div className="pkg-tree__item pkg-tree__item--root">
        <span className="pkg-tree__icon">📦</span>
        <span className="pkg-tree__name pkg-tree__name--root">{safeTitle}-package.zip</span>
      </div>

      {/* Top-level files */}
      {topLevel.map((f, i) => (
        <FileRow key={i} file={f} indent={1} />
      ))}

      {/* beats/ folder */}
      <FolderRow name="beats" children={beatsFiles} indent={1} />

      {/* completed-songs/ folder */}
      <FolderRow name="completed-songs" children={completedFiles} indent={1} />

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="pkg-tree__warnings">
          {warnings.map((w, i) => (
            <div key={i} className="pkg-tree__warning-item">⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
