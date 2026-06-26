import { useRef, useState } from "react";

interface Sample {
  t: number;
  wpm: number;
  raw: number;
}
interface ErrPoint {
  t: number;
  count: number;
}

/**
 * Monkeytype-style results graph: wpm + raw lines on a left axis, error markers
 * on a right axis, with gridlines, labelled axes, a legend, and a hover tooltip.
 * Dependency-free SVG.
 */
export default function WpmChart({
  samples,
  errors = [],
}: {
  samples: Sample[];
  errors?: ErrPoint[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 260;
  const padL = 46;
  const padR = 40;
  const padT = 24;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (samples.length < 2) {
    return (
      <div className="text-sub text-sm py-10 text-center">
        not enough data for a graph — type a little longer
      </div>
    );
  }

  const maxT = Math.max(1, ...samples.map((s) => s.t), ...errors.map((e) => e.t));
  const peak = Math.max(10, ...samples.map((s) => Math.max(s.wpm, s.raw)));
  const niceMax = Math.ceil(peak / 20) * 20;
  const maxErr = Math.max(1, ...errors.map((e) => e.count));

  const x = (t: number) => padL + (maxT <= 0 ? 0 : (t / maxT) * plotW);
  const yW = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const yE = (v: number) => padT + plotH - (v / maxErr) * plotH;

  const path = (key: "wpm" | "raw") =>
    samples
      .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.t).toFixed(1)} ${yW(s[key]).toFixed(1)}`)
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const errTicks = niceErrTicks(maxErr);
  const xStep = Math.max(1, Math.ceil(maxT / 8));
  const xTicks: number[] = [];
  for (let t = 0; t <= maxT; t += xStep) xTicks.push(t);
  if (xTicks[xTicks.length - 1] !== maxT) xTicks.push(maxT);

  const errByT = new Map(errors.map((e) => [e.t, e.count]));

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    // nearest sample by x
    let best = 0;
    let bestD = Infinity;
    samples.forEach((s, i) => {
      const d = Math.abs(x(s.t) - local.x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hv = hover != null ? samples[hover] : null;
  const hvErr = hv ? errByT.get(hv.t) ?? 0 : 0;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Words per minute and errors over time"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {/* horizontal gridlines + left (wpm) axis labels */}
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={padL} x2={W - padR} y1={yW(v)} y2={yW(v)} stroke="var(--sub-alt)" strokeWidth={1} />
          <text x={padL - 8} y={yW(v) + 4} textAnchor="end" fontSize={11} fill="var(--sub)">
            {v}
          </text>
        </g>
      ))}

      {/* right (errors) axis labels */}
      {errTicks.map((v) => (
        <text key={`e${v}`} x={W - padR + 8} y={yE(v) + 4} textAnchor="start" fontSize={11} fill="var(--error)">
          {v}
        </text>
      ))}

      {/* x axis ticks + labels */}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={H - padB + 18} textAnchor="middle" fontSize={11} fill="var(--sub)">
          {t}s
        </text>
      ))}

      {/* axis titles */}
      <text x={14} y={padT + plotH / 2} fontSize={11} fill="var(--sub)" transform={`rotate(-90 14 ${padT + plotH / 2})`} textAnchor="middle">
        words per minute
      </text>
      <text x={W - 8} y={padT + plotH / 2} fontSize={11} fill="var(--error)" transform={`rotate(90 ${W - 8} ${padT + plotH / 2})`} textAnchor="middle">
        errors
      </text>

      {/* raw line (faint) */}
      <path d={path("raw")} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.5} />
      {/* wpm line (neon, with glow) */}
      <path
        d={path("wpm")}
        fill="none"
        stroke="var(--main)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px var(--main))" }}
      />
      {/* wpm sample dots */}
      {samples.map((s, i) => (
        <circle key={i} cx={x(s.t)} cy={yW(s.wpm)} r={2.4} fill="var(--main)" />
      ))}

      {/* error markers (red ✕) on the right scale */}
      {errors.map((e, i) => (
        <text
          key={`m${i}`}
          x={x(e.t)}
          y={yE(e.count) + 5}
          textAnchor="middle"
          fontSize={14}
          fontWeight="bold"
          fill="var(--error)"
        >
          ✕
        </text>
      ))}

      {/* legend */}
      <g fontSize={11} transform={`translate(${padL}, 12)`}>
        <line x1={0} x2={18} y1={0} y2={0} stroke="var(--main)" strokeWidth={2.5} />
        <text x={22} y={4} fill="var(--text)">wpm</text>
        <line x1={64} x2={82} y1={0} y2={0} stroke="var(--accent)" strokeWidth={2} opacity={0.7} />
        <text x={86} y={4} fill="var(--sub)">raw</text>
        <text x={124} y={4} fill="var(--error)" fontWeight="bold">✕</text>
        <text x={136} y={4} fill="var(--sub)">errors</text>
      </g>

      {/* hover guide + tooltip */}
      {hv && (
        <g>
          <line x1={x(hv.t)} x2={x(hv.t)} y1={padT} y2={padT + plotH} stroke="var(--sub)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hv.t)} cy={yW(hv.wpm)} r={4} fill="var(--main)" stroke="var(--bg)" strokeWidth={1.5} />
          <Tooltip xPos={x(hv.t)} W={W} padR={padR} t={hv.t} wpm={hv.wpm} raw={hv.raw} err={hvErr} />
        </g>
      )}
    </svg>
  );
}

function Tooltip({
  xPos,
  W,
  padR,
  t,
  wpm,
  raw,
  err,
}: {
  xPos: number;
  W: number;
  padR: number;
  t: number;
  wpm: number;
  raw: number;
  err: number;
}) {
  const boxW = 104;
  const boxH = 56;
  // flip to the left if near the right edge
  const left = xPos > W - padR - boxW - 10 ? xPos - boxW - 8 : xPos + 8;
  const top = 28;
  return (
    <g transform={`translate(${left}, ${top})`} fontSize={11}>
      <rect width={boxW} height={boxH} rx={6} fill="var(--sub-alt)" stroke="var(--main)" strokeWidth={1} opacity={0.97} />
      <text x={8} y={15} fill="var(--sub)">{t}s</text>
      <text x={8} y={30} fill="var(--main)">{wpm} wpm</text>
      <text x={8} y={43} fill="var(--accent)">{raw} raw</text>
      <text x={62} y={30} fill="var(--error)">{err} err</text>
    </g>
  );
}

/** Integer-ish ticks for the errors axis (0..maxErr), at most ~5 of them. */
function niceErrTicks(maxErr: number): number[] {
  if (maxErr <= 5) return Array.from({ length: maxErr + 1 }, (_, i) => i);
  const step = Math.ceil(maxErr / 4);
  const ticks: number[] = [];
  for (let v = 0; v <= maxErr; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxErr) ticks.push(maxErr);
  return ticks;
}
