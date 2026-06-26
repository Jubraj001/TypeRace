// Wire protocol shared between the web client and the realtime race server.
// Versioned so we can evolve it without silently breaking older clients.
export const PROTOCOL_VERSION = 1;

export type RacePhase = "lobby" | "countdown" | "racing" | "finished";

export interface PlayerPublic {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  /** chars correctly typed so far (used to drive the progress bar) */
  progress: number;
  wpm: number;
  /** finishing rank, 1-based; null until the player finishes */
  rank: number | null;
  finished: boolean;
  connected: boolean;
}

export interface RaceStatePublic {
  code: string;
  phase: RacePhase;
  text: string;
  players: PlayerPublic[];
  /** epoch ms when racing begins (set during countdown), else null */
  startAt: number | null;
}

// ---- Client -> Server messages ----
export type ClientMessage =
  | { t: "create"; name: string; wordCount: number }
  | { t: "join"; code: string; name: string }
  | { t: "rejoin"; code: string; playerId: string; name: string }
  | { t: "ready"; ready: boolean }
  | { t: "start" } // host forces start
  | { t: "rematch" } // host resets a finished race back to lobby
  | { t: "progress"; progress: number; wpm: number }
  | { t: "finish"; wpm: number; accuracy: number };

// ---- Server -> Client messages ----
export type ServerMessage =
  | { t: "joined"; playerId: string; state: RaceStatePublic }
  | { t: "state"; state: RaceStatePublic }
  | { t: "countdown"; startAt: number }
  | { t: "error"; code: string; message: string };

export const DEFAULT_RACE_WORDS = 30;
