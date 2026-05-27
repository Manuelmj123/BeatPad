import React from "react";

const BAR_COUNT = 14;

/** Animated equalizer bars. `active` controls whether they animate. */
export default function SvgWaveform({ active = false, size = 32 }) {
  return (
    <div
      className={`waveform${active ? " waveform--active" : ""}`}
      style={{ height: size }}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span key={i} className="waveform__bar" style={{ "--i": i }} />
      ))}
    </div>
  );
}
