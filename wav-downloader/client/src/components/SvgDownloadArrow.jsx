import React from "react";

/**
 * SVG download arrow — circle with a downward arrow.
 * Bounce animation via CSS class.
 */
export default function SvgDownloadArrow({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`svg-download-arrow ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* Outer circle */}
      <circle
        cx="12" cy="12" r="10"
        stroke="url(#dlGrad)"
        strokeWidth="1.6"
        fill="rgba(74,222,128,0.06)"
      />

      {/* Downward arrow shaft */}
      <line
        x1="12" y1="7"
        x2="12" y2="15"
        stroke="url(#dlGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Arrowhead */}
      <polyline
        points="9,12.5 12,16 15,12.5"
        stroke="url(#dlGrad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
