import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ICONS = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
  warning: "⚠",
};

export default function Toast({ message, type = "info", onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in on mount
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300); // wait for slide-out animation
  }

  return createPortal(
    <div
      className={`toast toast--${type}${visible ? " toast--visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast__icon">{ICONS[type] ?? "ℹ"}</span>
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={handleDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>,
    document.body
  );
}
