# OneShot (원샷)

> **A web-first realtime party game hub — friends gather in one room and hot-swap between drinking/party games.**
> Gather with a single room code (or link/QR), the host picks a game and starts it, and when it ends everyone returns to the room to pick the next one.

🎮 **Live**: [oneshot.jsyoo.dev](https://oneshot.jsyoo.dev)

| | |
|---|---|
| ⚡ Realtime multiplayer | Colyseus WebSocket rooms · reconnect-token seat restore · host / interim host / kick |
| 🎨 2 themes × 2 languages | **cyber** (neon terminal HUD) · **cozy** (storybook) × Korean · English — always working together |
| 🔐 Authoritative server | Card dealing, turn validation, secret roles, and win/lose are decided only on the server. The client is UI & input only |
| 🧩 Extensible game hub | `GameModule` plugin architecture — a new game plugs in by filling fixed slots |

> The actual product code lives only in **`apps/oneshot/`**.
> Development rules and the **new-game recipe** are in [`CLAUDE.md`](./CLAUDE.md). Read it first before adding a game.

---

## 🎲 Game Library

**8 games playable today**, driven by the catalog (`shared/src/games/catalog.ts`) — and growing.

| | Game | Players | Complexity | One-line rules |
|---|---|---|---|---|
| ♔ | **King Game** | 2+ | ★ | The king calls out numbers and assigns a mission. 4 modes (free · mild · spicy · custom) + a bilingual mission pack — Korean and English players in the same room each read missions in their own language |
| ⛁ | **Upstage** | 3+ | ★★★ | A shedding game where **lower numbers are stronger**. Beat the current set with an equal-sized, lower set and empty your hand first. Two ★ wilds, penalty mode (tax exchange + revolt declaration), multi-hand rank-sum scoring |
| ◆ | **All Out** | 2–16 | ★★★ | Color/number-matching shedding game. Stacking +2/+4/+7 attacks, Shield/Reflect defense, Exchange · Reverse · color-change cards. Bankruptcy option, double deck at 9+ players, multi-round rank-sum scoring |
| ⚄ | **Dice Roll** | **1+** | ★ | Pure luck. Each round everyone throws two dice and ranks by the sum; total pips rolled break rank-sum ties. Solo luck-checking is a valid way to play |
| ◉ | **Roulette** | **1–24** | ★ | The wheel is split evenly among the players and spins by itself — whoever owns the slice under the pin wins. No input at all: the server gates a minimum spin duration and the client plays the reveal |
| ▤ | **Tile** | 2–8 | ★★★ | Tile-melding game. Build groups (same number, different colors) and runs (same color in sequence) from a 14-tile rack, rearrange the board, and empty your hand first. Drag from a staging copy of the rack; hold a tile and its neighbours join one at a time, so how long you hold is how much you pick up. Wedging a tile into a set splits it into two valid sets automatically |
| ◎ | **Liar** | 3+ | ★★ | Everyone gets the same secret word — except one liar. Debate out loud and vote out the liar (the app only keeps the word secret) |
| ✕ | **Fool Liar** | 3+ | ★ | A twist where the liar **doesn't even know they're the liar** — they receive a different word from the same category |
| ⌗ | Arithmetic | 2+ | ★★ | Roadmap (`coming_soon` — already registered in the catalog; flipping the status ships it) |

**Systems shared by every game** (patterns built once, inherited by the next game):

- **In-game setup phase** — game options (rounds, mode, penalty, …) are chosen by the host in a `setup` phase right after the game starts, not in the lobby.
- **Rank-sum scoring** — multi-round games (Upstage, All Out, Dice) share one convention: the lowest sum of per-round ranks wins.
- **Early-end vote** — anyone can propose ending the game early, decided by a vote counted against **connected players** (with a cooldown after a reject). Round progression isn't host-only either.
- **Disconnect ≠ leave** — refreshes and network blips restore your seat via a reconnect token. No auto-kick; the host manually skips a disconnected player's turn when needed. Turn clocks are **opt-in per game** (Tile's host picks 15s–unlimited in setup, and a timeout resolves softly by auto-drawing), never imposed by default.
- **In-game `?` help** — every game ships a `RulesModal` with rules in both ko & en, and it can render real game pieces inline, because "same number, different colors" is far easier to see than to read. Onboarding a first-time player is part of "done".
- **Direct manipulation** — games that move pieces around share one interaction contract: a local staging copy the player edits freely, a drop that fails or is cancelled (Escape, or the browser stealing the pointer) flying the pieces back to where they were picked up, live valid/invalid drop-target feedback, tap **and keyboard** paths for everything you can drag, and a coach line that says *why* the primary button is locked instead of just greying it out.
- **Home library preview** — the home screen lists every `available` game; tapping one expands a description, player range, and difficulty in place. It reads straight from the catalog, so shipping a game surfaces it here automatically.

> Per-game detailed rules live in code (`server/src/games/<id>/`) and the i18n help texts — those are the single source of truth.

---

## 🧩 Games Keep Getting Added — the Plugin Pipeline

The core design bet of this project: **the hub stays put, games swap in**. Every touch point for adding a game is pinned down by registries:

```
shared/  ─ GameId union + gameCatalog entry        (types · visibility · player range · options)
server/  ─ games/<id>/FooModule.ts                 (rules · validation · secrets · win/lose — all of it)
          └ one line in games/registry.ts
client/  ─ games/foo/FooGameScreen.tsx             (UI — design tokens & i18n only)
          └ one line in GAME_SCREENS in games/registry.tsx
```

The server-side contract is a single `GameModule` interface:

```ts
interface GameModule<TOptions, TPublicState, TPrivateState> {
  readonly id: GameId;
  readonly minPlayers: number;
  start(input: { players; options; randomSeed }): void;
  handleAction(input: { playerId; action; isHost }): ActionResult;
  getPublicState(): TPublicState;               // broadcast to everyone — never put secrets here
  getStateFor(playerId: string): TPrivateState; // that player only (hand · role · answer)
  onPlayerLeave / onPlayerReturn / onPlayerRemoved;  // disconnect / return / kick lifecycle
  isOver(): GameResult | null;
}
```

- Routing, lobby, seating, reconnect, themes, and i18n are **already provided by the hub**. A game only implements its rules (server) and its screen (client).
- A single catalog field — `status: "coming_soon" | "available"` — controls visibility. Register a game early, flip the value to ship.
- The traps are documented too: kick/disconnect robustness (the game must not stall when the actor of a waiting phase gets kicked), quorums counted against connected players, and more — all in [`CLAUDE.md`](./CLAUDE.md) §4 as a **complete recipe + checklist**. A game isn't done until its bot tests pass (full 2–10 player playthroughs + kick/reconnect edges).

---

## 🎨 Theme System — Build Each Game Once

Themes are a top-level concept. One line — `<html data-theme="...">` — restyles the entire app:

| | **cyber** (default) | **cozy** |
|---|---|---|
| Mood | dark neon terminal HUD | warm cream storybook |
| Details | corner brackets · scanlines · telemetry · sharp edges | rounded corners · soft 3D shadows · handwritten headings · circular avatars |

- Every color, font, spacing, and radius is defined only as **design tokens** (`client/src/design/terminal.css`). `:root` = cyber; the `[data-theme="cozy"]` block = cozy overrides.
- Which is why **games are never built twice per theme** — stick to tokens and both themes follow automatically.
- **Themes change the look, never the feature set.** Design, layout, and effects may differ (cyber glitches in; cozy springs open); the features, information, and interactions must be identical. Hiding a functional block in one theme is treated as a bug, not a style choice — only pure decoration (scanlines, corner brackets, telemetry) may be themed away.
- Player avatars are per-theme assets (`public/themes/<theme>/avatars/`), and **each player renders in their own theme** (a cozy user shows up with a cozy avatar on your cyber screen).
- i18n (ko · en) is the same invariant: every user-facing string must exist in both dictionaries.
- Every state/error page can be previewed in both themes at once via the `/_states` route.

---

## 🏗️ Architecture

A pnpm monorepo. The workspace root is **`apps/oneshot/`** (not the repo root).

| Package | Stack | Role |
|---|---|---|
| `client` | React 19 + Vite + TypeScript + Zustand | SPA. Screens · themes · i18n · UI kit |
| `server` | Colyseus + Express + Node + TypeScript | Authoritative server. Room lifecycle + game rules. Also statically serves the built `client/dist` |
| `shared` | TypeScript | Types shared by client/server · game catalog · mission packs |
| `e2e` | Playwright | Multi-client user-journey E2E |

**Core principles**

- **Authoritative server**: rules, validation, randomness (seeded `Randomizer`), and outcomes live only in server modules. Every client payload is parsed + validated server-side.
- **Minimal secret transmission**: other players' hands/roles/answers never reach your client at all — private data flows only through `getStateFor(playerId)`; `getPublicState()` carries public facts like `handCount` only.
- **Humans set the tempo**: no auto-kick, no forced timers by default — a turn clock exists only where the host opts in at game setup (e.g. Tile), and a timeout resolves softly (auto-draw) instead of punishing. The tempo of a party game belongs to the people, not the app.
- **Web fundamentals**: security headers (helmet) · gzip (compression) · rate limiting · CORS allowlist, favicon/OG/robots.txt, responsive design (mobile is part of the definition of done).

---

## 🚀 Quick Start

```bash
# New machine: install deps + generate .env (once)
bash apps/oneshot/setup.sh

# Dev servers (separate terminals) — run commands inside apps/oneshot
cd apps/oneshot
corepack pnpm --filter @oneshot/server dev   # http://localhost:2567
corepack pnpm --filter @oneshot/client dev   # http://localhost:5173 (5174 if taken)
```

Verification:

```bash
cd apps/oneshot
corepack pnpm -r typecheck
corepack pnpm --filter @oneshot/server test   # per-game bot tests (full playthroughs + kick/reconnect edges)
corepack pnpm test:e2e                        # Playwright user journeys (optional)
```

> ⚠️ Run pnpm commands inside **`apps/oneshot/`**. From the repo root they fail with `vitest: command not found`.
> Use `corepack pnpm` (a global pnpm may not exist). `.env` files are git-ignored; `setup.sh` generates them from `*/.env.example`.

---

## ✅ QA Philosophy — Screens, Journeys, Gestures

The definition of done has three layers (full checklists: CLAUDE.md §5 · §6 · §7):

1. **Per screen** — all **2 themes × 2 languages = 4 combinations** work, plus the `/_states` page and mobile widths (top bar collapses, 44px touch targets, no horizontal overflow). "Works" includes **feature parity**: both themes expose the same controls and information, and nothing that looks selectable is inert.
2. **Per journey** — catching the bugs that hide *between* screens: the right first screen per entry path (direct URL / invite link `/r/CODE` / QR / bad code), Enter pressing the button the user *meant*, the address bar always matching the room you're actually seated in, copy buttons copying exactly what their label says, and refresh/back/kick landing on a sensible screen.
3. **Per gesture** — anything with a time axis is invisible to screenshot QA, so it gets *measured* instead: hold a piece and assert the sequence of how many are picked up (`0 → 2 → 3 → 4`), that starting a drag freezes it there, and that releasing drops it all. The same pass catches decorative overlays that silently eat clicks — a HUD corner bracket missing `pointer-events: none` swallowed every click in all four screen corners — and device gates that lock people out (an orientation-only check walled off any desktop window taller than it is wide).

Every fixed journey bug gets pinned as an e2e test — `e2e/tests/home-enter.spec.ts` (Enter intent), `lobby-copy.spec.ts` (clipboard), `rummikub.spec.ts` (gestures, snap-back, device gate), `dice.spec.ts` · `allout-auto.spec.ts` (full playthroughs) set the precedent.

---

## ⚙️ Environment Variables

Only the `config` modules read env (no direct `process.env` / `import.meta.env` references in code). Everything is zod-validated; missing or weak values fail the boot.

**server** (`server/.env`)

| Variable | Default (dev) | Notes |
|---|---|---|
| `NODE_ENV` | development | `production` in prod |
| `SERVER_HOST` | 0.0.0.0 | |
| `SERVER_PORT` | 2567 | |
| `PUBLIC_ORIGIN` | http://localhost:5173 | Real domain in prod. CORS allowlist |
| `SESSION_SECRET` | dev-only-change-me | **Must be replaced in prod** (boot refuses the dev value) |
| `ROOM_CODE_LENGTH` / `ROOM_CODE_ALPHABET` | 5 / ambiguous chars excluded | |
| `COLYSEUS_RECONNECT_WINDOW_SECONDS` | 86400 | Reconnect window |
| `EMPTY_ROOM_TTL_SECONDS` | 3600 | Empty-room cleanup |

**client** (`client/.env`) — ⚠️ `VITE_*` values are **baked in at build time**. Decide the domain, then build.

| Variable | Default (dev) | Production example |
|---|---|---|
| `VITE_PUBLIC_ORIGIN` | http://localhost:5173 | https://oneshot.jsyoo.dev |
| `VITE_WS_URL` | ws://localhost:2567 | wss://oneshot.jsyoo.dev |
| `VITE_API_URL` | http://localhost:2567 | https://oneshot.jsyoo.dev |

> If unset, the client infers from the browser location (https → wss). That works, but explicit values are recommended in production.

---

## 📦 Deployment

The deployable unit is **one component**: a single Node server serves both the game (WebSocket) and the static client (`client/dist`).
**"Just point DNS" is not enough** — you need a reverse proxy (WebSocket upgrade), TLS, and process daemonization.

Current production: **Oracle Cloud VM + Docker + Caddy + Cloudflare** → [oneshot.jsyoo.dev](https://oneshot.jsyoo.dev)

1. **Prepare env** — Docker reads a single `apps/oneshot/.env` (`env_file: ../.env` in `ops/docker-compose.yml`). Combine server + client variables:
   ```bash
   # apps/oneshot/.env
   NODE_ENV=production
   PUBLIC_ORIGIN=https://oneshot.jsyoo.dev
   SESSION_SECRET=<strong 32+ char secret>
   VITE_PUBLIC_ORIGIN=https://oneshot.jsyoo.dev
   VITE_WS_URL=wss://oneshot.jsyoo.dev
   VITE_API_URL=https://oneshot.jsyoo.dev
   ```
2. **Build & run** (Docker)
   ```bash
   cd apps/oneshot
   docker compose -f ops/docker-compose.yml up -d --build   # :2567, restart=unless-stopped
   ```
   (Without Docker: `corepack pnpm install --frozen-lockfile && corepack pnpm build && node server/dist/index.js`)
3. **Caddy reverse proxy** — handles the WebSocket upgrade automatically and takes care of TLS.
   ```
   oneshot.jsyoo.dev {
     reverse_proxy localhost:2567
   }
   ```
4. Open 80/443 in the **Oracle security group**.
5. **Cloudflare**: A record → the Oracle public IP, SSL/TLS mode **Full**.
6. Verify: `curl https://oneshot.jsyoo.dev/healthz` → `{"ok":true,...}`

Pre-deploy checklist:
- [ ] `SESSION_SECRET` replaced / `NODE_ENV=production`
- [ ] Built with `VITE_*` set to the real domain (baked in at build time)
- [ ] `og:url` / `og:image` domains in `index.html` replaced with the real domain
- [ ] The `/colyseus` monitor auto-disables in production (re-enable behind auth if needed)

Shipping an update: on the server, `git pull` then re-run `docker compose -f ops/docker-compose.yml up -d --build`.

---

## 🗂️ Folder Map (summary)

```
apps/oneshot/
  client/   React+Vite SPA   (design/ ui/ games/ lobby/ room/ app/ i18n/ theme/ config/)
            public/themes/<theme>/{avatars,games}/   # per-theme assets
  server/   Colyseus server  (rooms/ games/<id>/ games/registry.ts config/ index.ts) + tests/
  shared/   Shared types     (schema/domain.ts, games/catalog.ts, games/<id>.ts, index.ts)
  e2e/      Playwright user-journey tests
  ops/      Dockerfile, docker-compose.yml
```

Detailed area map, theme/i18n rules, and the **new-game recipe** live in [`CLAUDE.md`](./CLAUDE.md).

---

## 🔒 Dependency Security

Per `corepack pnpm audit`: **no vulnerability affects the runtime deployable (server)** — every reported item is a transitive dependency of dev/test tooling.

- To force patched versions, `vite`/`esbuild` are pinned via `pnpm.overrides` in the root `package.json`, and `vitest` was major-upgraded (resolving 5 findings incl. critical/high around vite·esbuild).
- **The remaining 2 findings are accepted deliberately** (fixing them breaks upstream packages, and our usage path is non-exploitable):
  - `nanoid@2` (moderate) — `@colyseus/core` pins v2 internally. Room-code generation only uses the integer-length API, so the predictability issue doesn't apply. Kept until a colyseus upgrade.
  - `esbuild` (low) — transitive via the `tsup` build tool, on a **Windows/dev-server-only** path. Irrelevant to the (Linux) deployment.
- Re-run `corepack pnpm audit` after adding or upgrading dependencies.

---

## ⚖️ Copyright Notes

- Do not use existing games' trademarks, logos, character names, rank titles, card illustrations, or rulebook sentences.
- Rule explanations are written in our own words — never copied from rulebooks.
- When referencing external games, use generic comparative descriptions only; official names, art, and expressions are never used as product UI/content assets.
