import { useCallback, useEffect, useRef, useState } from "react";
import { computeStats, computeConsistency, type TypingStats } from "./stats";

export interface TypingSnapshot extends TypingStats {
  consistency: number;
  elapsedMs: number;
  /** {t: seconds, wpm, raw} samples for the results chart */
  samples: { t: number; wpm: number; raw: number }[];
  /** number of incorrect keystrokes per second, for the chart's error markers */
  errors: { t: number; count: number }[];
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
  // second-index of each incorrect keystroke (for the chart's error markers)
  const errorSecondsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSampleSecRef = useRef(-1);
  const targetRef = useRef(target);
  targetRef.current = target;

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    typedRef.current = "";
    samplesRef.current = [];
    errorSecondsRef.current = [];
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
    // aggregate per-second error counts
    const bySec = new Map<number, number>();
    for (const sec of errorSecondsRef.current) {
      bySec.set(sec + 1, (bySec.get(sec + 1) ?? 0) + 1);
    }
    const errors = [...bySec.entries()]
      .map(([t, count]) => ({ t, count }))
      .sort((a, b) => a.t - b.t);

    // add a trailing point at the actual end so the line reaches the finish
    const samples = samplesRef.current.slice();
    const endSec = Math.round((elapsed / 1000) * 10) / 10;
    const lastT = samples.length ? samples[samples.length - 1].t : 0;
    if (endSec - lastT > 0.2) {
      samples.push({ t: endSec, wpm: base.wpm, raw: base.raw });
    }

    return {
      ...base,
      consistency: computeConsistency(samplesRef.current.map((s) => s.wpm)),
      elapsedMs: elapsed,
      samples,
      errors,
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

    recordSample(elapsed, stats);

    if (timeLimitSec && elapsed >= timeLimitSec * 1000) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimitSec, finish]);

  // Push one wpm/raw sample per elapsed second (idempotent within a second).
  // Called from both the rAF tick and from keystrokes, so the graph still gets
  // data even where rAF is throttled.
  const recordSample = (elapsedMs: number, stats: TypingStats) => {
    // Sample at each *completed* second (1s, 2s, …). Sampling at ~0ms would
    // divide by near-zero time and produce a giant wpm spike that wrecks the
    // graph's scale. A trailing point is added in buildSnapshot.
    const sec = Math.floor(elapsedMs / 1000);
    if (sec >= 1 && sec > lastSampleSecRef.current) {
      lastSampleSecRef.current = sec;
      samplesRef.current.push({ t: sec, wpm: stats.wpm, raw: stats.raw });
    }
  };

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

      const idx = typedRef.current.length; // index of the char being typed
      typedRef.current += e.key;
      setTyped(typedRef.current);

      const elapsed = Math.max(nowMs() - (startRef.current ?? nowMs()), 0);
      // record an error marker if this keystroke was incorrect
      if (e.key !== t[idx]) {
        errorSecondsRef.current.push(Math.floor(elapsed / 1000));
      }

      const stats = computeStats(t, typedRef.current, Math.max(elapsed, 1));
      recordSample(elapsed, stats); // keep the graph fed even without rAF
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
