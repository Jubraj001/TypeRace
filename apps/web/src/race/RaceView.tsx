import { useEffect, useRef, useState } from "react";
import type { PlayerPublic, RacePhase } from "@shared/protocol";
import { useTyping } from "../engine/useTyping";
import TypingArea from "../components/TypingArea";
import ProgressBars from "./ProgressBars";

interface Props {
  text: string;
  players: PlayerPublic[];
  selfId: string | null;
  phase: RacePhase; // "countdown" | "racing"
  startAt: number | null;
  onProgress: (progress: number, wpm: number) => void;
  onFinish: (wpm: number, accuracy: number) => void;
  onLeave: () => void;
}

export default function RaceView({
  text,
  players,
  selfId,
  phase,
  startAt,
  onProgress,
  onFinish,
  onLeave,
}: Props) {
  const racing = phase === "racing";
  const finishedRef = useRef(false);
  const self = players.find((p) => p.id === selfId);
  const selfFinished = !!self?.finished;

  const { typed, cursor, phase: typingPhase, live, liveElapsedMs, handleKey } =
    useTyping({
    target: text,
    onProgress: (_typed, stats) => {
      // report correctly-typed char count as progress
      onProgress(stats.correctChars, stats.wpm);
    },
    onFinish: (snap) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinish(snap.wpm, snap.accuracy);
    },
  });

  // Only capture keys while the race is live.
  useEffect(() => {
    if (!racing) return;
    const onKey = (e: KeyboardEvent) => handleKey(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [racing, handleKey]);

  // Countdown number derived from startAt.
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (phase !== "countdown" || !startAt) {
      setCount(null);
      return;
    }
    const tick = () => {
      const remain = Math.ceil((startAt - Date.now()) / 1000);
      setCount(remain > 0 ? remain : 0);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase, startAt]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* live self stats while racing */}
      {racing && (
        <div className="flex justify-center gap-8 mb-4 font-display">
          <Stat label="wpm" value={`${live.wpm}`} />
          <Stat label="time" value={`${(liveElapsedMs / 1000).toFixed(0)}s`} />
          <Stat label="acc" value={`${Math.round(live.accuracy)}%`} />
        </div>
      )}

      <div className="mb-6">
        <ProgressBars players={players} textLength={text.length} selfId={selfId} />
      </div>

      <div className="relative">
        {phase === "countdown" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="font-display text-8xl font-black neon-text animate-pulse">
              {count === 0 ? "GO!" : count}
            </div>
          </div>
        )}

        {/* you-finished banner — keeps the screen readable while others race */}
        {selfFinished && racing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-bg/50 rounded-lg">
            <div className="text-center animate-[fadeIn_0.3s_ease]">
              <div className="font-display text-5xl font-black neon-text uppercase">
                finished {self?.rank ? `· ${ordinal(self.rank)}` : ""}
              </div>
              <div className="text-accent glow-accent font-display mt-2 tracking-wider">
                {self?.wpm} wpm · {Math.round(self?.accuracy ?? 0)}%
              </div>
              <div className="text-sub text-sm mt-3 font-display tracking-wider uppercase animate-pulse">
                waiting for other racers…
              </div>
            </div>
          </div>
        )}

        <div
          className="no-native-caret"
          style={{ opacity: racing && !selfFinished ? 1 : 0.35 }}
        >
          <TypingArea
            target={text}
            typed={typed}
            cursor={cursor}
            active={typingPhase === "running"}
            focused={true}
          />
        </div>
      </div>

      {racing && !selfFinished && (
        <p className="text-center text-accent glow-accent text-sm mt-8 font-display tracking-wider uppercase">
          first to finish wins 🏁
        </p>
      )}

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            // confirm only mid-race so you don't quit a live race by accident
            if (racing && !selfFinished && !confirm("Leave the race? Your spot is forfeited.")) {
              return;
            }
            onLeave();
          }}
          className="text-sub hover:text-error text-sm font-display uppercase tracking-wider transition-colors"
        >
          ← leave race
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl neon-text tabular-nums leading-none">{value}</div>
      <div className="text-sub text-xs uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
