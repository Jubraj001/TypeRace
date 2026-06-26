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
    this.touch();
    return p;
  }

  markDisconnected(id: string) {
    const p = this.players.get(id);
    if (!p) return;
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
    this.maybeAutoStart();
  }

  /** Auto-start once >=2 connected players are all ready. */
  private maybeAutoStart() {
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (
      this.phase === "lobby" &&
      connected.length >= 2 &&
      connected.every((p) => p.ready)
    ) {
      this.beginCountdown();
    }
  }

  /** Host may force-start even solo (for practice) or before everyone readies. */
  forceStart(id: string) {
    if (id !== this.hostId || this.phase !== "lobby") return;
    if ([...this.players.values()].some((p) => p.connected)) {
      this.beginCountdown();
    }
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
      p.rank = null;
      p.finished = false;
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
