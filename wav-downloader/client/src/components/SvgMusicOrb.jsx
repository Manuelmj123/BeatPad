import React from "react";

/** Floating music-note orb used in the empty state. */
export default function SvgMusicOrb({ size = 80 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className="music-orb"
    >
      {/* Glow circle */}
      <circle cx="40" cy="40" r="38" fill="url(#orbGrad)" opacity="0.18" />
      <circle cx="40" cy="40" r="30" fill="url(#orbGrad)" opacity="0.12" />

      {/* Music note */}
      <path
        d="M34 52V30l20-4v22"
        stroke="url(#orbGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="52" r="4" fill="url(#orbGrad)" />
      <circle cx="51" cy="48" r="4" fill="url(#orbGrad)" />

      <defs>
        <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
