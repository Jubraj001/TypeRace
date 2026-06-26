import type { TypingSnapshot } from "../engine/useTyping";
import WpmChart from "./WpmChart";

interface Props {
  snap: TypingSnapshot;
  personalBest?: number | null;
  onRestart: () => void;
  /** optional extra content (e.g. race placement) shown above the stats */
  header?: React.ReactNode;
}

export default function Results({ snap, personalBest, onRestart, header }: Props) {
  const isPB = personalBest != null && snap.wpm >= personalBest;
  return (
    <div className="w-full max-w-3xl mx-auto animate-[fadeIn_0.25s_ease]">
      {header}
      <div className="flex items-center gap-10">
        <div>
          <div className="text-accent text-sm font-display uppercase tracking-widest glow-accent">
            wpm
          </div>
          <div className="font-display text-7xl font-black neon-text leading-none">
            {snap.wpm}
          </div>
          {isPB && (
            <div className="text-accent text-xs mt-1 glow-accent font-display tracking-wider">
              ★ NEW HIGH SCORE
            </div>
          )}
        </div>
        <div>
          <div className="text-accent text-sm font-display uppercase tracking-widest glow-accent">
            acc
          </div>
          <div className="font-display text-7xl font-black neon-text leading-none">
            {Math.round(snap.accuracy)}%
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-sub-alt/40 neon-box p-4">
        <WpmChart samples={snap.samples} />
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <Stat label="raw" value={`${snap.raw}`} />
        <Stat label="consistency" value={`${snap.consistency}%`} />
        <Stat
          label="characters"
          value={`${snap.correctChars}/${snap.incorrectChars}`}
        />
        <Stat label="time" value={`${(snap.elapsedMs / 1000).toFixed(1)}s`} />
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onRestart}
          className="px-6 py-2 rounded-md bg-sub-alt neon-box text-main font-display uppercase tracking-wider hover:brightness-125 transition-all"
        >
          next ▸ <kbd className="text-xs ml-2">tab</kbd>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sub text-xs font-display uppercase tracking-wider">{label}</div>
      <div className="text-accent text-xl font-display glow-accent">{value}</div>
    </div>
  );
}
