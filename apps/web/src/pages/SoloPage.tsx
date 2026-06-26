import { useCallback, useEffect, useMemo, useState } from "react";
import { generateText } from "@shared/words";
import { useTyping } from "../engine/useTyping";
import TypingField from "../components/TypingField";
import Results from "../components/Results";
import { personalBest, saveResult } from "../lib/storage";
import { clearRaceSession } from "../race/useRaceSocket";

type Mode =
  | { kind: "time"; value: number }
  | { kind: "words"; value: number };

const TIME_OPTIONS = [15, 30, 60];
const WORD_OPTIONS = [10, 25, 50];

export default function SoloPage() {
  const [mode, setMode] = useState<Mode>({ kind: "words", value: 25 });
  const [seedKey, setSeedKey] = useState(0); // bump to regenerate text

  // Being on the solo page means you've left any multiplayer race — forget the
  // saved session so we never silently auto-rejoin a stale room later.
  useEffect(() => {
    clearRaceSession();
  }, []);

  // For time mode, supply a generous buffer of words.
  const wordCount = mode.kind === "words" ? mode.value : 80;
  const target = useMemo(
    () => generateText(wordCount),
    // regenerate when mode/word-count changes or on manual restart
    [wordCount, seedKey, mode.kind]
  );

  const modeId = `${mode.kind}:${mode.value}`;
  const pb = personalBest(modeId);

  const { typed, cursor, phase, live, liveElapsedMs, result, reset, handleKey } = useTyping({
    target,
    timeLimitSec: mode.kind === "time" ? mode.value : undefined,
    onFinish: (snap) => {
      saveResult({
        wpm: snap.wpm,
        accuracy: snap.accuracy,
        mode: modeId,
        at: Date.now(),
      });
    },
  });

  const restart = useCallback(() => {
    setSeedKey((k) => k + 1);
    reset();
  }, [reset]);

  // Clicking the typingNinja logo dispatches this — start a fresh test.
  useEffect(() => {
    const onRestart = () => restart();
    window.addEventListener("typingninja:restart", onRestart);
    return () => window.removeEventListener("typingninja:restart", onRestart);
  }, [restart]);

  if (phase === "done" && result) {
    return (
      <Results
        snap={result}
        personalBest={pb}
        onRestart={restart}
        header={
          <div className="text-sub text-sm mb-4">
            {mode.kind} · {mode.value} {mode.kind === "time" ? "seconds" : "words"}
          </div>
        }
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mode bar */}
      <div className="flex flex-wrap items-center justify-center gap-1 mb-8 sm:mb-10 text-xs sm:text-sm bg-sub-alt/60 neon-box rounded-lg px-3 sm:px-4 py-2 w-fit mx-auto font-display uppercase tracking-wider">
        <ModeGroup
          label="time"
          options={TIME_OPTIONS}
          active={mode.kind === "time" ? mode.value : null}
          onPick={(v) => {
            setMode({ kind: "time", value: v });
            setSeedKey((k) => k + 1);
          }}
        />
        <span className="text-sub-alt mx-2">|</span>
        <ModeGroup
          label="words"
          options={WORD_OPTIONS}
          active={mode.kind === "words" ? mode.value : null}
          onPick={(v) => {
            setMode({ kind: "words", value: v });
            setSeedKey((k) => k + 1);
          }}
        />
      </div>

      {/* Live counter */}
      <div className="h-8 mb-2 neon-text font-display text-3xl tabular-nums">
        {phase === "running" &&
          (mode.kind === "time"
            ? Math.max(0, mode.value - Math.floor(liveElapsedMs / 1000))
            : `${live.wpm}`)}
        {phase === "running" && (
          <span className="text-accent glow-accent text-base ml-2 tracking-wider">
            {mode.kind === "time" ? `${live.wpm} WPM` : "WPM"}
          </span>
        )}
      </div>

      <div className="no-native-caret">
        <TypingField
          target={target}
          typed={typed}
          cursor={cursor}
          active={phase === "running"}
          onKey={handleKey}
          onControl={restart}
          idleHint="tap / click to type"
        />
      </div>

      <div className="text-center text-sub text-xs mt-10">
        <span className="hidden sm:inline">
          <kbd>tab</kbd> restart · <kbd>esc</kbd> new test
        </span>
        {pb != null && <span className="sm:ml-4">best: {pb} wpm</span>}
      </div>
    </div>
  );
}

function ModeGroup({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: number[];
  active: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sub mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className={`px-2 py-0.5 rounded transition-colors ${
            active === o ? "text-main neon-text" : "text-sub hover:text-accent"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
