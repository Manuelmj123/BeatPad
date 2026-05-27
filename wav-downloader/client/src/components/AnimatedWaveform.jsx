import React from "react";

const BAR_COUNT = 12;

/**
 * Animated waveform bars — idle when inactive, bouncing when active.
 * @param {{ active: boolean }} props
 */
export default function AnimatedWaveform({ active = false }) {
  return (
    <div
      className={`waveform-container${active ? " waveform-active" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{ "--bar-index": i }}
        />
      ))}
    </div>
  );
}
