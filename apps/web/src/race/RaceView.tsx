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
}

export default function RaceView({
  text,
  players,
  selfId,
  phase,
  startAt,
  onProgress,
  onFinish,
}: Props) {
  const racing = phase === "racing";
  const finishedRef = useRef(false);

  const { typed, cursor, phase: typingPhase, handleKey } = useTyping({
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
        <div className="no-native-caret" style={{ opacity: racing ? 1 : 0.35 }}>
          <TypingArea
            target={text}
            typed={typed}
            cursor={cursor}
            active={typingPhase === "running"}
            focused={true}
          />
        </div>
      </div>

      {racing && (
        <p className="text-center text-accent glow-accent text-sm mt-8 font-display tracking-wider uppercase">
          first to finish wins 🏁
        </p>
      )}
    </div>
  );
}
