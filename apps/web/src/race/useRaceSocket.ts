import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RaceStatePublic,
  ServerMessage,
} from "@shared/protocol";

const SERVER_URL =
  import.meta.env.VITE_RACE_SERVER ?? "ws://localhost:8787";

const SESSION_KEY = "typerace:session"; // { code, playerId }

interface Session {
  code: string;
  playerId: string;
}

export interface RaceSocket {
  connected: boolean;
  state: RaceStatePublic | null;
  playerId: string | null;
  error: string | null;
  createRace: (name: string, wordCount: number) => void;
  joinRace: (code: string, name: string) => void;
  setReady: (ready: boolean) => void;
  start: () => void;
  rematch: () => void;
  sendProgress: (progress: number, wpm: number) => void;
  sendFinish: (wpm: number, accuracy: number) => void;
  clearError: () => void;
}

/**
 * Manages the WebSocket connection to the race server. Auto-reconnects and,
 * if we already had a player id for the current room code, transparently rejoins.
 */
export function useRaceSocket(code: string | undefined, name: string): RaceSocket {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RaceStatePublic | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  nameRef.current = name;
  const sentProgressRef = useRef(0);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Attempt a rejoin if we have a saved session for this code.
        const sess = loadSession();
        if (code && sess && sess.code === code) {
          send({ t: "rejoin", code, playerId: sess.playerId, name: nameRef.current });
        }
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        handleServerMessage(msg);
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1000);
      };

      ws.onerror = () => ws.close();
    };

    const handleServerMessage = (msg: ServerMessage) => {
      switch (msg.t) {
        case "joined":
          setPlayerId(msg.playerId);
          setState(msg.state);
          saveSession({ code: msg.state.code, playerId: msg.playerId });
          break;
        case "state":
          setState(msg.state);
          break;
        case "countdown":
          // state message follows; nothing extra needed here
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
    // reconnect only when target server/code changes
  }, [code, send]);

  const createRace = useCallback(
    (n: string, wordCount: number) => send({ t: "create", name: n, wordCount }),
    [send]
  );
  const joinRace = useCallback(
    (c: string, n: string) => send({ t: "join", code: c.toUpperCase(), name: n }),
    [send]
  );
  const setReady = useCallback((ready: boolean) => send({ t: "ready", ready }), [send]);
  const start = useCallback(() => send({ t: "start" }), [send]);
  const rematch = useCallback(() => send({ t: "rematch" }), [send]);

  const sendProgress = useCallback(
    (progress: number, wpm: number) => {
      // throttle: only send when progress advanced
      if (progress === sentProgressRef.current) return;
      sentProgressRef.current = progress;
      send({ t: "progress", progress, wpm });
    },
    [send]
  );
  const sendFinish = useCallback(
    (wpm: number, accuracy: number) => {
      sentProgressRef.current = 0;
      send({ t: "finish", wpm, accuracy });
    },
    [send]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    connected,
    state,
    playerId,
    error,
    createRace,
    joinRace,
    setReady,
    start,
    rematch,
    sendProgress,
    sendFinish,
    clearError,
  };
}

function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}
function saveSession(s: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
