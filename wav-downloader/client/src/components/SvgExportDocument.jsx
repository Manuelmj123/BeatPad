import React from "react";

/**
 * SVG document with an export arrow indicator.
 * Used in the export modal.
 */
export default function SvgExportDocument({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`svg-export-document ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* Document body */}
      <path
        d="M7 4H19L25 10V28H7V4Z"
        stroke="url(#docGrad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="rgba(74,222,128,0.05)"
      />

      {/* Folded corner */}
      <path
        d="M19 4V10H25"
        stroke="url(#docGrad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Text lines */}
      <line x1="11" y1="15" x2="21" y2="15" stroke="url(#docGrad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <line x1="11" y1="19" x2="21" y2="19" stroke="url(#docGrad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <line x1="11" y1="23" x2="17" y2="23" stroke="url(#docGrad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />

      {/* Export arrow (top-right corner overlay) */}
      <circle cx="25" cy="7" r="5" fill="#0d1220" />
      <path
        d="M22.5 9.5L27.5 4.5"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <polyline
        points="24.5,4.5 27.5,4.5 27.5,7.5"
        stroke="#60a5fa"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
