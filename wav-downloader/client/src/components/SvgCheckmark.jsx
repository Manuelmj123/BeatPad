import React from "react";

/** Animated SVG checkmark drawn via stroke-dashoffset animation. */
export default function SvgCheckmark({ size = 56 }) {
  return (
    <svg
      className="checkmark-svg"
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="checkmark-svg__circle"
        cx="26" cy="26" r="25"
        stroke="#4ade80"
        strokeWidth="2"
        fill="none"
      />
      <path
        className="checkmark-svg__check"
        d="M14.1 27.2l7.1 7.2 16.7-16.8"
        stroke="#4ade80"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
