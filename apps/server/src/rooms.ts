import type { WebSocket } from "ws";
import {
  type PlayerPublic,
  type RacePhase,
  type RaceStatePublic,
  type ServerMessage,
} from "../../../shared/protocol.ts";
import { generateText } from "../../../shared/words.ts";

interface Player {
  id: string;
  name: string;
  ready: boolean;
  progress: number;
  wpm: number;
  accuracy: number;
  rank: number | null;
  finished: boolean;
  timeMs: number | null;
  connected: boolean;
  socket: WebSocket | null;
}

const COUNTDOWN_MS = 4000; // 3..2..1..go
const IDLE_ROOM_MS = 10 * 60 * 1000;
const RACE_MAX_MS = 5 * 60 * 1000;

export class Room {
  code: string;
  phase: RacePhase = "lobby";
  text: string;
  hostId: string | null = null;
  startAt: number | null = null;
  players = new Map<string, Player>();
  lastActivity = Date.now();
  private countdownTimer: NodeJS.Timeout | null = null;
  private raceTimer: NodeJS.Timeout | null = null;
  private finishCount = 0;

  constructor(code: string, wordCount: number) {
    this.code = code;
    this.text = generateText(wordCount);
  }

  addPlayer(id: string, name: string, socket: WebSocket): Player {
    const isFirst = this.players.size === 0;
    const player: Player = {
      id,
      name: name.slice(0, 24) || "guest",
      ready: false,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      rank: null,
      finished: false,
      timeMs: null,
      connected: true,
      socket,
    };
    this.players.set(id, player);
    if (isFirst || this.hostId === null) this.hostId = id;
    this.touch();
    return player;
  }

  reconnect(id: string, name: string, socket: WebSocket): Player | null {
    const p = this.players.get(id);
    if (!p) return null;
    p.connected = true;
    p.socket = socket;
    if (name) p.name = name.slice(0, 24);
    // If the room currently has no host (e.g. the host's socket dropped during a
    // create→navigate reconnect, or the host left and is now back), reclaim it.
    if (this.hostId === null) this.hostId = id;
    this.touch();
    return p;
  }

  markDisconnected(id: string, socket?: WebSocket) {
    const p = this.players.get(id);
    if (!p) return;
    // Ignore a stale close from an old socket after the player already
    // reconnected on a new one (create→navigate reconnect race).
    if (socket && p.socket && p.socket !== socket) return;
    p.connected = false;
    p.socket = null;
    // If host left, promote another connected player.
    if (this.hostId === id) {
      const next = [...this.players.values()].find((x) => x.connected);
      this.hostId = next ? next.id : null;
    }
    this.touch();
  }

  setReady(id: string, ready: boolean) {
    const p = this.players.get(id);
    if (!p || this.phase !== "lobby") return;
    p.ready = ready;
    this.touch();
    // No auto-start — only the host starts the race (see forceStart).
  }

  /**
   * Can the race be started? Requires 2+ connected players and every
   * non-host connected player to be ready. (The host's click is the go signal,
   * so the host doesn't need to ready up themselves.)
   */
  canStart(): boolean {
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length < 2) return false;
    return connected
      .filter((p) => p.id !== this.hostId)
      .every((p) => p.ready);
  }

  /** Only the host starts, and only once everyone else is ready. */
  forceStart(id: string) {
    if (id !== this.hostId || this.phase !== "lobby") return;
    if (this.canStart()) this.beginCountdown();
  }

  private beginCountdown() {
    if (this.phase !== "lobby") return;
    this.phase = "countdown";
    this.startAt = Date.now() + COUNTDOWN_MS;
    this.broadcast({ t: "countdown", startAt: this.startAt });
    this.broadcastState();
    this.countdownTimer = setTimeout(() => {
      this.phase = "racing";
      this.broadcastState();
      // Hard cap so a stalled racer can't keep the room "racing" forever.
      this.raceTimer = setTimeout(() => this.endRace(), RACE_MAX_MS);
    }, COUNTDOWN_MS);
    this.touch();
  }

  updateProgress(id: string, progress: number, wpm: number) {
    const p = this.players.get(id);
    if (!p || this.phase !== "racing" || p.finished) return;
    p.progress = Math.max(0, progress);
    p.wpm = Math.max(0, Math.round(wpm));
    this.touch();
  }

  finishPlayer(id: string, wpm: number, accuracy: number) {
    const p = this.players.get(id);
    if (!p || p.finished || this.phase !== "racing") return;
    p.finished = true;
    p.wpm = Math.round(wpm);
    p.accuracy = Math.round(accuracy);
    p.timeMs = this.startAt ? Math.max(0, Date.now() - this.startAt) : null;
    p.rank = ++this.finishCount;
    this.touch();
    this.broadcastState();
    // End the race once every connected player has finished.
    const connected = [...this.players.values()].filter((x) => x.connected);
    if (connected.length > 0 && connected.every((x) => x.finished)) {
      this.endRace();
    }
  }

  private endRace() {
    if (this.phase === "finished") return;
    if (this.raceTimer) clearTimeout(this.raceTimer);
    this.phase = "finished";
    this.broadcastState();
    this.touch();
  }

  /** Reset back to lobby for a rematch, keeping the same players. */
  rematch(id: string) {
    if (id !== this.hostId) return;
    if (this.phase !== "finished") return;
    this.phase = "lobby";
    this.startAt = null;
    this.finishCount = 0;
    this.text = generateText(this.text.split(" ").length);
    for (const p of this.players.values()) {
      p.ready = false;
      p.progress = 0;
      p.wpm = 0;
      p.accuracy = 100;
      p.rank = null;
      p.finished = false;
      p.timeMs = null;
    }
    this.broadcastState();
    this.touch();
  }

  isEmpty(): boolean {
    return ![...this.players.values()].some((p) => p.connected);
  }

  isStale(): boolean {
    return Date.now() - this.lastActivity > IDLE_ROOM_MS;
  }

  dispose() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.raceTimer) clearTimeout(this.raceTimer);
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  toPublic(): RaceStatePublic {
    const players: PlayerPublic[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      isHost: p.id === this.hostId,
      progress: p.progress,
      wpm: p.wpm,
      accuracy: p.accuracy,
      timeMs: p.timeMs,
      rank: p.rank,
      finished: p.finished,
      connected: p.connected,
    }));
    return {
      code: this.code,
      phase: this.phase,
      text: this.text,
      players,
      startAt: this.startAt,
    };
  }

  broadcastState() {
    this.broadcast({ t: "state", state: this.toPublic() });
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.connected && p.socket && p.socket.readyState === 1) {
        p.socket.send(data);
      }
    }
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor() {
    setInterval(() => this.sweep(), 60_000).unref?.();
  }

  create(wordCount: number): Room {
    let code = this.newCode();
    while (this.rooms.has(code)) code = this.newCode();
    const room = new Room(code, wordCount);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  private sweep() {
    for (const [code, room] of this.rooms) {
      if (room.isStale()) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  private newCode(): string {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily-confused chars
    let s = "";
    for (let i = 0; i < 6; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  }
}
