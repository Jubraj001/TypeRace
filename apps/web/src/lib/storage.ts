// Local persistence for personal bests and recent results (no backend in v1).

export interface ResultRecord {
  wpm: number;
  accuracy: number;
  mode: string; // e.g. "time:30" or "words:25"
  at: number; // epoch ms
}

const RESULTS_KEY = "typerace:results";
const THEME_KEY = "theme";
const NAME_KEY = "typerace:name";

export function loadResults(): ResultRecord[] {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveResult(r: ResultRecord): void {
  const all = loadResults();
  all.unshift(r);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(all.slice(0, 100)));
}

/** Best WPM for a given mode, or null if none recorded. */
export function personalBest(mode: string): number | null {
  const best = loadResults()
    .filter((r) => r.mode === mode)
    .reduce((m, r) => Math.max(m, r.wpm), 0);
  return best > 0 ? best : null;
}

export function getTheme(): string {
  return localStorage.getItem(THEME_KEY) ?? "neon-tokyo";
}
export function setTheme(t: string): void {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute("data-theme", t);
}

export function getName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}
export function setName(n: string): void {
  localStorage.setItem(NAME_KEY, n);
}
