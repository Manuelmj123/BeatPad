import React from "react";

/**
 * SVG audio waveform bars (6 bars of varying height).
 * Green gradient with pulsing animation.
 */
export default function SvgAudioWave({ size = 32, active = true, className = "" }) {
  const bars = [
    { height: 10, delay: "0ms"   },
    { height: 18, delay: "80ms"  },
    { height: 26, delay: "160ms" },
    { height: 20, delay: "80ms"  },
    { height: 14, delay: "120ms" },
    { height: 8,  delay: "40ms"  },
  ];
  const barWidth = 3;
  const gap      = 2;
  const totalW   = bars.length * (barWidth + gap) - gap;
  const maxH     = 28;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalW} ${maxH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`svg-audio-wave ${active ? "svg-audio-wave--active" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {bars.map((bar, i) => {
        const x = i * (barWidth + gap);
        const h = active ? bar.height : 4;
        const y = (maxH - h) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx="1.5"
            fill="url(#waveGrad)"
            style={
              active
                ? {
                    animation:      `waveBarPulse 0.8s ease-in-out infinite alternate`,
                    animationDelay: bar.delay,
                  }
                : { opacity: 0.25 }
            }
          />
        );
      })}
    </svg>
  );
}
