// Quick end-to-end smoke test: two players create/join, ready up, race, finish.
import WebSocket from "ws";

const URL = "ws://localhost:8787";
const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, playerId: null, state: null, events: [] };
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    c.events.push(m);
    if (m.t === "joined") {
      c.playerId = m.playerId;
      c.state = m.state;
    }
    if (m.t === "state") c.state = m.state;
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.ready = () => new Promise((res) => ws.once("open", res));
  return c;
}

const a = client("Alice");
const b = client("Bob");
await Promise.all([a.ready(), b.ready()]);

// Alice creates
a.send({ t: "create", name: "Alice", wordCount: 10 });
await wait(200);
const code = a.state.code;
log("created room:", code, "| text:", JSON.stringify(a.state.text.slice(0, 30) + "…"));

// Bob joins
b.send({ t: "join", code, name: "Bob" });
await wait(200);
log("players after join:", a.state.players.map((p) => p.name).join(", "));

// Both ready -> auto countdown
a.send({ t: "ready", ready: true });
b.send({ t: "ready", ready: true });
await wait(300);
log("phase after both ready:", a.state.phase, "| startAt set:", a.state.startAt != null);

// wait for countdown -> racing
await wait(4200);
log("phase after countdown:", a.state.phase);

// simulate typing progress
const text = a.state.text;
a.send({ t: "progress", progress: 20, wpm: 80 });
b.send({ t: "progress", progress: 10, wpm: 40 });
await wait(150);
const aliceBar = a.state.players.find((p) => p.name === "Alice").progress;
log("Alice progress broadcast:", aliceBar);

// finish in order: Alice first, Bob second
a.send({ t: "finish", wpm: 95, accuracy: 98 });
await wait(150);
b.send({ t: "finish", wpm: 60, accuracy: 92 });
await wait(250);

const ranks = a.state.players
  .map((p) => `${p.name}#${p.rank}(${p.wpm}wpm)`)
  .join(", ");
log("final phase:", a.state.phase, "| ranks:", ranks);

// rematch by host (Alice)
a.send({ t: "rematch" });
await wait(200);
log("phase after rematch:", a.state.phase, "| progress reset:", a.state.players.every((p) => p.progress === 0));

const ok =
  a.state.phase === "lobby" &&
  ranks.includes("Alice#1") &&
  ranks.includes("Bob#2") &&
  aliceBar === 20;
log(ok ? "\n✅ E2E SMOKE PASSED" : "\n❌ E2E SMOKE FAILED");

a.ws.close();
b.ws.close();
process.exit(ok ? 0 : 1);
