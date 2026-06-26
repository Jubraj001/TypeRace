import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRaceSocket } from "../race/useRaceSocket";
import { getName, setName as persistName } from "../lib/storage";
import { DEFAULT_RACE_WORDS, type PlayerPublic } from "@shared/protocol";
import RaceView from "../race/RaceView";
import TypingGif from "../components/TypingGif";

export default function RacePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState(getName() || "");
  const socket = useRaceSocket(code, name);

  // Once we receive our room's code, reflect it in the URL.
  useEffect(() => {
    if (socket.state?.code && socket.state.code !== code) {
      navigate(`/race/${socket.state.code}`, { replace: true });
    }
  }, [socket.state?.code, code, navigate]);

  const joined = useMemo(
    () =>
      !!socket.playerId &&
      !!socket.state?.players.some((p) => p.id === socket.playerId),
    [socket.playerId, socket.state]
  );

  // Leave the race entirely: forget the session (so we don't auto-rejoin) and
  // go home. Navigating away unmounts this page, which closes the socket and
  // frees our slot on the server.
  const leave = () => {
    socket.leaveRace();
    navigate("/");
  };

  // --- No code in URL: create-or-join landing ---
  if (!code) {
    return (
      <Landing
        name={name}
        setName={setName}
        connected={socket.connected}
        error={socket.error}
        onCreate={() => {
          persistName(name);
          socket.createRace(name || "guest", DEFAULT_RACE_WORDS);
        }}
        onJoin={(c) => {
          persistName(name);
          navigate(`/race/${c.toUpperCase()}`);
        }}
      />
    );
  }

  // --- Code in URL but not yet a participant: join prompt ---
  if (!joined) {
    return (
      <JoinPrompt
        code={code}
        name={name}
        setName={setName}
        connected={socket.connected}
        error={socket.error}
        onJoin={() => {
          persistName(name);
          socket.joinRace(code, name || "guest");
        }}
      />
    );
  }

  const state = socket.state!;

  // --- Finished: results + rematch ---
  if (state.phase === "finished") {
    const me = state.players.find((p) => p.id === socket.playerId);
    return (
      <div className="w-full max-w-2xl mx-auto text-center animate-[fadeIn_0.3s_ease]">
        <div className="text-accent text-xs glow-accent tracking-[0.3em] mb-1">
          リザルト
        </div>
        <h2 className="font-display text-5xl font-black neon-text uppercase mb-1 flicker">
          race complete
        </h2>
        {me?.rank && (
          <p className="font-display text-lg mb-6">
            <span className="text-accent glow-accent">
              you finished {ordinal(me.rank)}
            </span>{" "}
            <span className="text-sub">· {me.wpm} wpm · {Math.round(me.accuracy)}%</span>
          </p>
        )}
        <Leaderboard players={state.players} selfId={socket.playerId} />
        <div className="mt-8 flex justify-center gap-3">
          {state.players.find((p) => p.id === socket.playerId)?.isHost && (
            <button
              onClick={socket.rematch}
              className="px-5 py-2 rounded-md bg-main text-bg font-display font-bold uppercase tracking-wider neon-box hover:brightness-125 transition-all"
            >
              ↻ race again
            </button>
          )}
          <button
            onClick={() => {
              socket.leaveRace();
              navigate("/race");
            }}
            className="px-5 py-2 rounded-md bg-sub-alt neon-box text-accent font-display uppercase tracking-wider hover:brightness-125 transition-all"
          >
            new room
          </button>
        </div>
      </div>
    );
  }

  // --- Lobby ---
  if (state.phase === "lobby") {
    return <Lobby state={state} socket={socket} onLeave={leave} />;
  }

  // --- Countdown / racing ---
  return (
    <RaceView
      text={state.text}
      players={state.players}
      selfId={socket.playerId}
      phase={state.phase}
      startAt={state.startAt}
      onProgress={socket.sendProgress}
      onFinish={socket.sendFinish}
      onLeave={leave}
    />
  );
}

// ---------- Landing ----------
function Landing({
  name,
  setName,
  connected,
  error,
  onCreate,
  onJoin,
}: {
  name: string;
  setName: (s: string) => void;
  connected: boolean;
  error: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <h1 className="font-display text-3xl font-black neon-text uppercase mb-1">versus mode</h1>
      <p className="text-accent text-xs glow-accent tracking-widest mb-8">対戦モード</p>
      <NameInput name={name} setName={setName} />
      <ConnBadge connected={connected} />
      {error && <ErrorBadge text={error} />}

      <button
        disabled={!connected}
        onClick={onCreate}
        className="w-full mt-4 px-5 py-3 rounded-md bg-main text-bg font-display font-bold uppercase tracking-wider neon-box hover:brightness-125 transition-all disabled:opacity-40"
      >
        ▸ create a race
      </button>

      <div className="flex items-center gap-3 my-6 text-sub text-xs">
        <div className="flex-1 h-px bg-sub-alt" /> or <div className="flex-1 h-px bg-sub-alt" />
      </div>

      <div className="flex gap-2">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="race code"
          maxLength={6}
          className="flex-1 px-3 py-2 rounded-md bg-sub-alt text-text tracking-widest uppercase outline-none focus:ring-1 ring-main"
        />
        <button
          disabled={joinCode.length < 4}
          onClick={() => onJoin(joinCode)}
          className="px-4 py-2 rounded-md bg-sub-alt text-text hover:text-main disabled:opacity-40"
        >
          join
        </button>
      </div>
    </div>
  );
}

// ---------- Join prompt (came via shared link) ----------
function JoinPrompt({
  code,
  name,
  setName,
  connected,
  error,
  onJoin,
}: {
  code: string;
  name: string;
  setName: (s: string) => void;
  connected: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <h1 className="font-display text-3xl font-black neon-text uppercase mb-1">join race</h1>
      <p className="text-sub text-sm mb-8 font-display tracking-wider">
        room <span className="text-accent glow-accent tracking-widest">{code}</span>
      </p>
      <NameInput name={name} setName={setName} onEnter={onJoin} />
      <ConnBadge connected={connected} />
      {error && <ErrorBadge text={error} />}
      <button
        disabled={!connected}
        onClick={onJoin}
        className="w-full mt-4 px-5 py-3 rounded-md bg-main text-bg font-display font-bold uppercase tracking-wider neon-box hover:brightness-125 transition-all disabled:opacity-40"
      >
        ▸ join race
      </button>
    </div>
  );
}

// ---------- Lobby ----------
function Lobby({
  state,
  socket,
  onLeave,
}: {
  state: NonNullable<ReturnType<typeof useRaceSocket>["state"]>;
  socket: ReturnType<typeof useRaceSocket>;
  onLeave: () => void;
}) {
  const me = state.players.find((p) => p.id === socket.playerId);
  const [copied, setCopied] = useState(false);
  const shareUrl = `${location.origin}/race/${state.code}`;

  // Mirror the server's start rule so the host's button is enabled exactly when
  // a start would succeed: 2+ connected players and all non-host players ready.
  const connected = state.players.filter((p) => p.connected);
  const playerCount = connected.length;
  const canStart =
    playerCount >= 2 && connected.filter((p) => !p.isHost).every((p) => p.ready);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; user can select manually */
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-black neon-text uppercase mb-1">race lobby</h1>
      <p className="text-sub text-sm mb-5 font-display tracking-wider">
        room <span className="text-accent glow-accent tracking-widest text-lg">{state.code}</span>
      </p>

      <div className="flex gap-2 mb-6">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 px-3 py-2 rounded-md bg-sub-alt text-sub text-sm outline-none"
        />
        <button
          onClick={copy}
          className="px-4 py-2 rounded-md bg-main text-bg text-sm font-display font-bold uppercase tracking-wider neon-box hover:brightness-125 transition-all"
        >
          {copied ? "copied!" : "copy link"}
        </button>
      </div>

      <ul className="space-y-2 mb-6">
        {state.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between px-3 py-2 rounded-md bg-sub-alt/50"
          >
            <span className="text-text">
              {p.name}
              {p.id === socket.playerId && <span className="text-sub text-xs"> (you)</span>}
              {p.isHost && <span className="text-main text-xs ml-2">host</span>}
            </span>
            <span
              className={`text-sm font-display uppercase tracking-wide ${
                p.isHost
                  ? "text-sub"
                  : p.ready
                    ? "text-main glow-accent"
                    : "text-sub"
              }`}
            >
              {p.isHost ? "host" : p.ready ? "✓ ready" : "waiting"}
            </span>
          </li>
        ))}
      </ul>

      {me?.isHost ? (
        <>
          <button
            onClick={socket.start}
            disabled={!canStart}
            className="w-full px-5 py-3 rounded-md bg-main text-bg font-display font-bold uppercase tracking-wider neon-box hover:brightness-125 transition-all disabled:opacity-40 disabled:hover:brightness-100"
          >
            ▸ start race
          </button>
          <p className="text-sub text-xs mt-3 text-center font-display tracking-wider">
            {playerCount < 2
              ? "waiting for another racer to join…"
              : !canStart
                ? "waiting for everyone to ready up…"
                : "everyone's ready — start when you are"}
          </p>
        </>
      ) : (
        <>
          <button
            onClick={() => socket.setReady(!me?.ready)}
            className={`w-full px-5 py-3 rounded-md font-display font-bold uppercase tracking-wider transition-all hover:brightness-125 ${
              me?.ready ? "bg-sub-alt neon-box text-accent" : "bg-main text-bg neon-box"
            }`}
          >
            {me?.ready ? "✓ ready — waiting for host" : "ready up"}
          </button>
          <p className="text-sub text-xs mt-3 text-center font-display tracking-wider">
            the host starts the race once everyone is ready
          </p>
        </>
      )}

      <TypingGif caption="warming up…" className="mt-8" />

      <div className="mt-6 text-center">
        <button
          onClick={onLeave}
          className="text-sub hover:text-error text-sm font-display uppercase tracking-wider transition-colors"
        >
          ← leave race
        </button>
      </div>
    </div>
  );
}

// ---------- small shared bits ----------
function NameInput({
  name,
  setName,
  onEnter,
}: {
  name: string;
  setName: (s: string) => void;
  onEnter?: () => void;
}) {
  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      placeholder="your name"
      maxLength={24}
      className="w-full px-3 py-2 rounded-md bg-sub-alt text-text text-center outline-none focus:ring-1 ring-main"
    />
  );
}

function ConnBadge({ connected }: { connected: boolean }) {
  return (
    <div className="text-xs mt-3 text-sub">
      {connected ? (
        <span className="text-main">● connected</span>
      ) : (
        <span>○ connecting to server…</span>
      )}
    </div>
  );
}

function ErrorBadge({ text }: { text: string }) {
  return <div className="text-error text-sm mt-3">{text}</div>;
}

// ---------- Final standings ----------
function Leaderboard({
  players,
  selfId,
}: {
  players: PlayerPublic[];
  selfId: string | null;
}) {
  const ranked = [...players].sort((a, b) => {
    if (a.finished && b.finished) return (a.rank ?? 0) - (b.rank ?? 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });

  return (
    <div className="rounded-lg bg-sub-alt/40 neon-box overflow-hidden text-left">
      <div className="grid grid-cols-[2.5rem_1fr_4rem_4rem_5rem] gap-2 px-4 py-2 text-xs text-sub font-display uppercase tracking-wider border-b border-sub/30">
        <span>#</span>
        <span>racer</span>
        <span className="text-right">wpm</span>
        <span className="text-right">acc</span>
        <span className="text-right">time</span>
      </div>
      {ranked.map((p, i) => {
        const isSelf = p.id === selfId;
        return (
          <div
            key={p.id}
            className={`grid grid-cols-[2.5rem_1fr_4rem_4rem_5rem] gap-2 px-4 py-2.5 items-center font-display ${
              i === 0 ? "bg-main/10" : ""
            }`}
          >
            <span className={`text-lg ${i === 0 ? "neon-text" : "text-sub"}`}>
              {p.finished ? (i === 0 ? "①" : ordinal(p.rank ?? i + 1)) : "—"}
            </span>
            <span className={`truncate ${isSelf ? "neon-text" : "text-text"}`}>
              {p.name}
              {isSelf && <span className="text-sub text-xs ml-1">(you)</span>}
              {!p.finished && <span className="text-sub text-xs ml-2">dnf</span>}
            </span>
            <span className="text-right text-accent glow-accent">
              {p.finished ? p.wpm : "–"}
            </span>
            <span className="text-right text-text">
              {p.finished ? `${Math.round(p.accuracy)}%` : "–"}
            </span>
            <span className="text-right text-sub tabular-nums">
              {p.timeMs != null ? formatTime(p.timeMs) : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatTime(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}
