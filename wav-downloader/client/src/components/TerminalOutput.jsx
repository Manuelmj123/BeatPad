import React, { useEffect, useRef } from "react";

/**
 * macOS-style terminal panel that streams yt-dlp output lines.
 * Auto-scrolls to the bottom as new lines arrive.
 */
export default function TerminalOutput({ lines, visible }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!visible && lines.length === 0) return null;

  return (
    <div className="terminal" role="log" aria-live="polite" aria-label="yt-dlp output">
      <div className="terminal-header">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <span className="terminal-title">yt-dlp output</span>
      </div>
      <div className="terminal-body">
        {lines.length === 0 ? (
          <div className="terminal-line line-muted">Starting download…</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`terminal-line ${classifyLine(line)}`}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/** Assign a CSS colour class based on line content. */
function classifyLine(line) {
  if (/error/i.test(line)) return "line-error";
  if (/warning/i.test(line)) return "line-warning";
  if (/\[download\].*\d+%/.test(line)) return "line-progress";
  if (/\[ExtractAudio\]|\[ffmpeg\]|Destination:/i.test(line)) return "line-info";
  return "";
}
