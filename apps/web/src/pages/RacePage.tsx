import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRaceSocket } from "../race/useRaceSocket";
import { getName, setName as persistName } from "../lib/storage";
import { DEFAULT_RACE_WORDS } from "@shared/protocol";
import RaceView from "../race/RaceView";
import ProgressBars from "../race/ProgressBars";

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
    return (
      <div className="w-full max-w-2xl mx-auto">
        <h2 className="font-display text-3xl font-black neon-text uppercase mb-1 flicker">
          race complete
        </h2>
        <p className="text-accent text-xs glow-accent tracking-widest mb-6">
          リザルト · room {state.code}
        </p>
        <ProgressBars
          players={state.players}
          textLength={state.text.length}
          selfId={socket.playerId}
        />
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
            onClick={() => navigate("/race")}
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
    return <Lobby state={state} socket={socket} />;
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
}: {
  state: NonNullable<ReturnType<typeof useRaceSocket>["state"]>;
  socket: ReturnType<typeof useRaceSocket>;
}) {
  const me = state.players.find((p) => p.id === socket.playerId);
  const [copied, setCopied] = useState(false);
  const shareUrl = `${location.origin}/race/${state.code}`;

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
            <span className={p.ready ? "text-main text-sm" : "text-sub text-sm"}>
              {p.ready ? "ready" : "not ready"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <button
          onClick={() => socket.setReady(!me?.ready)}
          className={`flex-1 px-5 py-3 rounded-md font-display font-bold uppercase tracking-wider transition-all hover:brightness-125 ${
            me?.ready ? "bg-sub-alt neon-box text-accent" : "bg-main text-bg neon-box"
          }`}
        >
          {me?.ready ? "✓ ready" : "ready up"}
        </button>
        {me?.isHost && (
          <button
            onClick={socket.start}
            className="px-5 py-3 rounded-md bg-sub-alt neon-box text-accent font-display uppercase tracking-wider hover:brightness-125 transition-all"
            title="Start now (host)"
          >
            start ▸
          </button>
        )}
      </div>
      <p className="text-sub text-xs mt-4 text-center">
        race auto-starts when everyone is ready (2+ players)
      </p>
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
