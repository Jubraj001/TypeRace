// Pure typing-stat math. No React, no DOM — easy to unit test.

export type CharStatus = "correct" | "incorrect" | "pending" | "extra";

export interface TypingStats {
  /** net WPM: (correct chars / 5) / minutes */
  wpm: number;
  /** raw WPM: (all typed chars / 5) / minutes */
  raw: number;
  /** percentage 0-100 of typed chars that were correct */
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  typedChars: number;
}

const STANDARD_WORD = 5;

export function computeStats(
  target: string,
  typed: string,
  elapsedMs: number
): TypingStats {
  let correct = 0;
  let incorrect = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < target.length && typed[i] === target[i]) correct++;
    else incorrect++;
  }
  const minutes = Math.max(elapsedMs, 1) / 60000;
  const wpm = correct / STANDARD_WORD / minutes;
  const raw = typed.length / STANDARD_WORD / minutes;
  const accuracy = typed.length === 0 ? 100 : (correct / typed.length) * 100;
  return {
    wpm: clampRound(wpm),
    raw: clampRound(raw),
    accuracy: Math.round(accuracy * 10) / 10,
    correctChars: correct,
    incorrectChars: incorrect,
    typedChars: typed.length,
  };
}

/**
 * Consistency = how steady the per-interval WPM was, as a 0-100 score.
 * Derived from the coefficient of variation of the WPM samples.
 */
export function computeConsistency(wpmSamples: number[]): number {
  const xs = wpmSamples.filter((n) => Number.isFinite(n) && n > 0);
  if (xs.length < 2) return 100;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.round((1 - cv) * 100));
}

/** Per-character statuses for rendering the text. */
export function charStatuses(target: string, typed: string): CharStatus[] {
  const out: CharStatus[] = new Array(target.length);
  for (let i = 0; i < target.length; i++) {
    if (i >= typed.length) out[i] = "pending";
    else if (typed[i] === target[i]) out[i] = "correct";
    else out[i] = "incorrect";
  }
  return out;
}

function clampRound(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}
