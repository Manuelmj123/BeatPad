import React from "react";

/**
 * Animated upload cloud icon.
 * Arrow pointing upward into a cloud shape with a gentle float animation.
 */
export default function SvgUploadCloud({ size = 48, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`svg-upload-cloud ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* Cloud shape */}
      <path
        d="M34 20.5C33.3 16.7 30 14 26 14c-3.1 0-5.8 1.7-7.3 4.2C15.4 18.6 13 21.2 13 24.5
           c0 3.6 2.9 6.5 6.5 6.5H34c3 0 5.5-2.5 5.5-5.5S37 20.5 34 20.5z"
        stroke="url(#cloudGrad)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Upload arrow */}
      <line
        x1="24" y1="34"
        x2="24" y2="24"
        stroke="url(#cloudGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        className="upload-arrow-shaft"
      />
      <polyline
        points="20,28 24,24 28,28"
        stroke="url(#cloudGrad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="upload-arrow-head"
      />
    </svg>
  );
}
