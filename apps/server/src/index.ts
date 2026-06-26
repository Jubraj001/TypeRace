import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import {
  type ClientMessage,
  type ServerMessage,
  DEFAULT_RACE_WORDS,
} from "../../../shared/protocol.ts";
import { Room, RoomManager } from "./rooms.ts";

const PORT = Number(process.env.PORT ?? 8787);
const manager = new RoomManager();

// Per-connection context.
interface Conn {
  playerId: string | null;
  room: Room | null;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[typerace] race server listening on ws://localhost:${PORT}`);

wss.on("connection", (socket: WebSocket) => {
  const ctx: Conn = { playerId: null, room: null };

  socket.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(socket, { t: "error", code: "bad_json", message: "Invalid message" });
    }
    handle(socket, ctx, msg);
  });

  socket.on("close", () => {
    if (ctx.room && ctx.playerId) {
      ctx.room.markDisconnected(ctx.playerId, socket);
      ctx.room.broadcastState();
    }
  });

  socket.on("error", () => {
    /* ignore; close handler does cleanup */
  });
});

function handle(socket: WebSocket, ctx: Conn, msg: ClientMessage) {
  switch (msg.t) {
    case "create": {
      const room = manager.create(clampWords(msg.wordCount));
      joinRoom(socket, ctx, room, randomUUID(), msg.name);
      break;
    }
    case "join": {
      const room = manager.get(msg.code);
      if (!room) return send(socket, notFound());
      if (room.phase !== "lobby") {
        return send(socket, {
          t: "error",
          code: "in_progress",
          message: "That race has already started.",
        });
      }
      joinRoom(socket, ctx, room, randomUUID(), msg.name);
      break;
    }
    case "rejoin": {
      const room = manager.get(msg.code);
      if (!room) return send(socket, notFound());
      const player = room.reconnect(msg.playerId, msg.name, socket);
      if (!player) {
        // unknown id (room recycled) — join fresh if still in lobby
        if (room.phase === "lobby") {
          joinRoom(socket, ctx, room, randomUUID(), msg.name);
        } else {
          send(socket, notFound());
        }
        return;
      }
      ctx.room = room;
      ctx.playerId = player.id;
      send(socket, { t: "joined", playerId: player.id, state: room.toPublic() });
      room.broadcastState();
      break;
    }
    case "ready":
      ctx.room?.setReady(req(ctx), msg.ready);
      ctx.room?.broadcastState();
      break;
    case "start":
      ctx.room?.forceStart(req(ctx));
      break;
    case "rematch":
      ctx.room?.rematch(req(ctx));
      break;
    case "progress":
      ctx.room?.updateProgress(req(ctx), msg.progress, msg.wpm);
      // progress is fanned out via periodic state broadcast (below) or immediately
      ctx.room?.broadcastState();
      break;
    case "finish":
      ctx.room?.finishPlayer(req(ctx), msg.wpm, msg.accuracy);
      break;
    default:
      send(socket, { t: "error", code: "unknown", message: "Unknown message type" });
  }
}

function joinRoom(
  socket: WebSocket,
  ctx: Conn,
  room: Room,
  id: string,
  name: string
) {
  const player = room.addPlayer(id, name, socket);
  ctx.room = room;
  ctx.playerId = player.id;
  send(socket, { t: "joined", playerId: player.id, state: room.toPublic() });
  room.broadcastState();
}

function req(ctx: Conn): string {
  return ctx.playerId ?? "";
}

function notFound(): ServerMessage {
  return { t: "error", code: "not_found", message: "Race not found." };
}

function clampWords(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_RACE_WORDS;
  return Math.min(60, Math.max(10, Math.round(n)));
}

function send(socket: WebSocket, msg: ServerMessage) {
  if (socket.readyState === 1) socket.send(JSON.stringify(msg));
}
