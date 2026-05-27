import React from "react";

/**
 * SVG package/box icon with gradient stroke.
 * Used in the export modal.
 */
export default function SvgPackageBox({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`svg-package-box ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pkgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* Box body */}
      <path
        d="M4 10L16 4L28 10V22L16 28L4 22V10Z"
        stroke="url(#pkgGrad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="rgba(96,165,250,0.06)"
      />

      {/* Middle horizontal crease */}
      <path
        d="M4 10L16 16L28 10"
        stroke="url(#pkgGrad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Vertical center line */}
      <line
        x1="16" y1="16"
        x2="16" y2="28"
        stroke="url(#pkgGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Ribbon/tape on top-left face */}
      <path
        d="M10 7L16 10"
        stroke="url(#pkgGrad)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
