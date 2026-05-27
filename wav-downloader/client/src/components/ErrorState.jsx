import React from "react";

/**
 * Shown when the download fails.
 * Displays a friendly error message with a shake animation.
 */
export default function ErrorState({ message }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-icon" aria-hidden="true">
        {/* X mark SVG */}
        <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="error-title">Download Failed</h3>
      <p className="error-message">{message}</p>
    </div>
  );
}
