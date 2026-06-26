import { useCallback, useEffect, useRef, useState } from "react";
import { computeStats, computeConsistency, type TypingStats } from "./stats";

export interface TypingSnapshot extends TypingStats {
  consistency: number;
  elapsedMs: number;
  /** {t: seconds, wpm, raw} samples for the results chart */
  samples: { t: number; wpm: number; raw: number }[];
}

export type TypingPhase = "idle" | "running" | "done";

export interface UseTypingResult {
  typed: string;
  phase: TypingPhase;
  /** index of the next char to type (caret position) */
  cursor: number;
  /** live stats, updated ~10x/sec while running */
  live: TypingStats;
  /** ms elapsed since the first keystroke (0 before start) */
  liveElapsedMs: number;
  startTime: number | null;
  reset: () => void;
  finish: () => void;
  result: TypingSnapshot | null;
}

interface Options {
  target: string;
  /** optional time limit in seconds; when reached the test auto-finishes */
  timeLimitSec?: number;
  onFinish?: (snap: TypingSnapshot) => void;
  /** called on each accepted keystroke with the new typed string */
  onProgress?: (typed: string, stats: TypingStats) => void;
}

/**
 * Headless typing engine. Captures keystrokes (call `handleKey` via the returned
 * binder), tracks timing, samples WPM for the chart, and emits a final snapshot.
 */
export function useTyping({
  target,
  timeLimitSec,
  onFinish,
  onProgress,
}: Options): UseTypingResult & { handleKey: (e: KeyboardEvent) => void } {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<TypingPhase>("idle");
  const [live, setLive] = useState<TypingStats>(() =>
    computeStats(target, "", 1)
  );
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [result, setResult] = useState<TypingSnapshot | null>(null);

  const startRef = useRef<number | null>(null);
  const typedRef = useRef("");
  const samplesRef = useRef<{ t: number; wpm: number; raw: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSampleSecRef = useRef(-1);
  const targetRef = useRef(target);
  targetRef.current = target;

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    typedRef.current = "";
    samplesRef.current = [];
    lastSampleSecRef.current = -1;
    setTyped("");
    setPhase("idle");
    setResult(null);
    setLiveElapsedMs(0);
    setLive(computeStats(targetRef.current, "", 1));
  }, []);

  // reset whenever the target text changes
  useEffect(() => {
    reset();
  }, [target, reset]);

  const buildSnapshot = useCallback((): TypingSnapshot => {
    const now = nowMs();
    const elapsed = startRef.current ? now - startRef.current : 1;
    const base = computeStats(targetRef.current, typedRef.current, elapsed);
    return {
      ...base,
      consistency: computeConsistency(samplesRef.current.map((s) => s.wpm)),
      elapsedMs: elapsed,
      samples: samplesRef.current.slice(),
    };
  }, []);

  const finish = useCallback(() => {
    if (phase === "done") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const snap = buildSnapshot();
    setResult(snap);
    setPhase("done");
    onFinish?.(snap);
  }, [phase, buildSnapshot, onFinish]);

  // rAF loop: refresh live stats + sample once per second, check time limit.
  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const elapsed = nowMs() - startRef.current;
    const stats = computeStats(targetRef.current, typedRef.current, elapsed);
    setLive(stats);
    setLiveElapsedMs(elapsed);

    const sec = Math.floor(elapsed / 1000);
    if (sec > lastSampleSecRef.current) {
      lastSampleSecRef.current = sec;
      samplesRef.current.push({ t: sec + 1, wpm: stats.wpm, raw: stats.raw });
    }

    if (timeLimitSec && elapsed >= timeLimitSec * 1000) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimitSec, finish]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (phase === "done") return;
      const t = targetRef.current;

      // Backspace (with mac/word/line variants)
      if (e.key === "Backspace") {
        e.preventDefault();
        if (typedRef.current.length === 0) return;
        if (e.metaKey) {
          // ⌘+Backspace → delete back to the start (mac "delete line")
          typedRef.current = "";
        } else if (e.altKey || e.ctrlKey) {
          // ⌥/Ctrl+Backspace → delete the previous word
          typedRef.current = deletePrevWord(typedRef.current);
        } else {
          typedRef.current = typedRef.current.slice(0, -1);
        }
        setTyped(typedRef.current);
        return;
      }

      // Only accept single printable characters
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();

      if (typedRef.current.length >= t.length) return; // don't overflow target

      // start timer on first keystroke
      if (startRef.current === null) {
        startRef.current = nowMs();
        setPhase("running");
        rafRef.current = requestAnimationFrame(tick);
      }

      typedRef.current += e.key;
      setTyped(typedRef.current);

      const elapsed = nowMs() - (startRef.current ?? nowMs());
      const stats = computeStats(t, typedRef.current, Math.max(elapsed, 1));
      onProgress?.(typedRef.current, stats);

      // word-count mode: finished when the full target is typed
      if (!timeLimitSec && typedRef.current.length >= t.length) {
        finish();
      }
    },
    [phase, tick, timeLimitSec, finish, onProgress]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    typed,
    phase,
    cursor: typed.length,
    live,
    liveElapsedMs,
    startTime: startRef.current,
    reset,
    finish,
    result,
    handleKey,
  };
}

function nowMs(): number {
  return performance.now();
}

/** Remove the trailing word: any trailing spaces, then the word before them. */
function deletePrevWord(s: string): string {
  let i = s.length;
  while (i > 0 && s[i - 1] === " ") i--;
  while (i > 0 && s[i - 1] !== " ") i--;
  return s.slice(0, i);
}
