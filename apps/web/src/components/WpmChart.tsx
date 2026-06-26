interface Sample {
  t: number;
  wpm: number;
  raw: number;
}

/** Minimal dependency-free line chart of WPM (and raw WPM) over time. */
export default function WpmChart({ samples }: { samples: Sample[] }) {
  const W = 560;
  const H = 180;
  const padL = 34;
  const padB = 22;
  const padT = 10;
  const padR = 8;

  if (samples.length < 2) {
    return (
      <div className="text-sub text-sm py-8 text-center">
        Not enough data for a graph — type a little longer.
      </div>
    );
  }

  const maxT = Math.max(...samples.map((s) => s.t));
  const maxY = Math.max(10, ...samples.map((s) => Math.max(s.wpm, s.raw)));
  const niceMax = Math.ceil(maxY / 20) * 20;

  const x = (t: number) =>
    padL + (t / maxT) * (W - padL - padR);
  const y = (v: number) =>
    H - padB - (v / niceMax) * (H - padB - padT);

  const path = (key: "wpm" | "raw") =>
    samples
      .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${y(s[key]).toFixed(1)}`)
      .join(" ");

  const yTicks = [0, niceMax / 2, niceMax];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Words per minute over time"
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--sub-alt)"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={y(v) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--sub)"
          >
            {Math.round(v)}
          </text>
        </g>
      ))}
      {/* raw (cyan, faint) */}
      <path
        d={path("raw")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        opacity={0.55}
      />
      {/* net wpm (neon main with glow) */}
      <path
        d={path("wpm")}
        fill="none"
        stroke="var(--main)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px var(--main))" }}
      />
      {/* x labels */}
      <text x={padL} y={H - 6} fontSize={11} fill="var(--sub)">
        0s
      </text>
      <text x={W - padR} y={H - 6} fontSize={11} fill="var(--sub)" textAnchor="end">
        {maxT}s
      </text>
    </svg>
  );
}
