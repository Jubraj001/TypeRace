# typerace

A fast, crisp Monkeytype-style typing test with realtime multiplayer racing.
Share a link and race anyone live.

- **Solo:** time (15/30/60s) and word (10/25/50) modes, gliding caret, live WPM /
  accuracy / consistency, a WPM-over-time graph, and local personal bests.
- **Multiplayer:** create a race, share the link, and watch everyone's live
  progress bars. Auto-starts when all players ready (or host can force-start).

## Stack
- `apps/web` — React + Vite + Tailwind v4 (frontend, fully client-side for solo)
- `apps/server` — Node + `ws` realtime race server (in-memory rooms, no DB)
- `shared` — word list + race text generation + typed WebSocket protocol,
  imported by both (buildless TS via Vite alias / `tsx`)

## Prerequisites
Node 18+ (pinned to 22 via `.nvmrc`):

```bash
nvm install 22   # first time only
nvm use          # picks up .nvmrc
```

## Setup & run
```bash
npm run install:all   # install root + web + server deps
npm run dev           # runs web (http://localhost:5173) + server (ws://localhost:8787)
```

Then open http://localhost:5173. For multiplayer, hit **multiplayer**, create a
race, and open the shared link in another browser/incognito window.

### Individual commands
```bash
npm run dev:web       # frontend only
npm run dev:server    # race server only
npm --prefix apps/web test   # unit tests (typing-stat math)
npm run build         # production build of the web app
```

## Configuration
- `VITE_RACE_SERVER` — WebSocket URL for the race server (default
  `ws://localhost:8787`). Inlined at **build time** by Vite, so set it before
  building/deploying the frontend (changing it requires a rebuild).
- `PORT` — race server port (default `8787`). Set automatically by most hosts.

## Deployment
The frontend is static (→ Vercel). The race server is a long-lived WebSocket
process with in-memory rooms, which **cannot run on Vercel's serverless
functions** — host it on Railway (or Render/Fly.io).

### Frontend → Vercel
Import the repo and keep **Root Directory = repo root** (the build imports
`shared/`, which lives outside `apps/web`). `vercel.json` already sets the
install/build commands and SPA rewrites. Add an env var:

```
VITE_RACE_SERVER = wss://<your-railway-server>.up.railway.app
```

Use `wss://` (secure) — a browser on an `https://` page blocks plain `ws://`.

### Server → Railway
Create a service from the same repo, **Root Directory = repo root**
(`nixpacks.toml` builds and starts `apps/server`). Railway injects `PORT` and
gives you a public `wss://` URL — paste that into Vercel's `VITE_RACE_SERVER`
and redeploy the frontend.

## Project layout
```
shared/            words.ts (generateText), protocol.ts (WS messages)
apps/web/src/
  engine/          stats.ts (+ tests), useTyping.ts  ← headless typing engine
  components/      TypingArea (gliding caret), Results, WpmChart
  race/            useRaceSocket, RaceView, ProgressBars
  pages/           SoloPage, RacePage (landing/lobby/race/results)
apps/server/src/   index.ts (ws server), rooms.ts (room lifecycle)
```

## How multiplayer works
The server is authoritative on the race text and start time. Each client computes
its own WPM and sends throttled `progress` updates; the server fans them out to
the room so everyone sees live bars. No accounts in v1 — players use a temporary
display name, stats persist locally in the browser.
