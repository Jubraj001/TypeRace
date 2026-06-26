import type { PlayerPublic } from "@shared/protocol";

interface Props {
  players: PlayerPublic[];
  textLength: number;
  selfId: string | null;
}

/** Live race track: one animated bar per player. */
export default function ProgressBars({ players, textLength, selfId }: Props) {
  const ordered = [...players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank ?? 0) - (b.rank ?? 0);
    return b.progress - a.progress;
  });

  return (
    <div className="space-y-2">
      {ordered.map((p) => {
        const pct = textLength > 0 ? Math.min(100, (p.progress / textLength) * 100) : 0;
        const isSelf = p.id === selfId;
        const barColor = isSelf ? "var(--main)" : "var(--accent)";
        const glow = isSelf ? "var(--glow)" : "var(--accent)";
        return (
          <div key={p.id} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-sm truncate font-display uppercase tracking-wide">
              <span
                className={isSelf ? "neon-text" : "text-accent glow-accent"}
              >
                {p.name}
              </span>
              {!p.connected && <span className="text-sub text-xs"> (left)</span>}
            </div>
            <div className="relative flex-1 h-7 rounded-sm bg-sub-alt/70 overflow-hidden border border-sub/40">
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, transparent, ${barColor})`,
                  boxShadow: isSelf
                    ? `0 0 10px rgba(var(--glow), 0.6)`
                    : `0 0 10px color-mix(in srgb, ${glow} 50%, transparent)`,
                  opacity: p.connected ? 1 : 0.4,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 text-sm transition-[left] duration-150 ease-out"
                style={{
                  left: `calc(${pct}% - 12px)`,
                  color: barColor,
                  textShadow: `0 0 8px ${barColor}`,
                }}
              >
                {p.finished ? "🏁" : "▸"}
              </div>
            </div>
            <div className="w-20 shrink-0 text-right text-sm tabular-nums font-display">
              {p.finished ? (
                <span className="neon-text">#{p.rank}</span>
              ) : (
                <span className="text-accent glow-accent">{p.wpm}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
