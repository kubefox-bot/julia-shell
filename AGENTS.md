# AGENTS.md

Last updated: 2026-03-16

## Purpose
This is Yulia's Astro app in Shell-Core v1.2 architecture.

Primary goals now:
- extension-like shell with widget registry,
- `.m4a` / `.opus` transcription via Gemini API,
- Batumi weather widget with cache,
- stable local dashboard on Windows target host.

## Canonical Target Host
Primary deployment target:
- Host IP: `192.168.100.102`
- SSH user: `sshuser`
- OS: Windows
- Project path on target: `C:\Users\julia\OneDrive\ssr`
- Main browser URL: `http://julia.love:4321`
- Direct LAN URL: `http://192.168.100.102:4321`

Important:
- treat Windows copy as runtime source of truth,
- treat this Mac copy as development mirror,
- sync into `C:\Users\julia\OneDrive\ssr`.

## Sync / Upload Notes
Exclude from sync:
- `node_modules`
- `.astro`
- `dist`
- `dev.stdout.log`
- `dev.stderr.log`
- `coverage`

Safe approach:
- sync source/config only,
- run install/build on Windows.
- monorepo sync target remains `C:\Users\julia\OneDrive\ssr`; keep `apps/*` and `packages/*` in sync together.

## Package Manager
- package manager: `Yarn 4`
- linker: `node-modules`
- Windows command path usually via `corepack.cmd`

Useful commands:
- `yarn install`
- `yarn prepare` (post-install rust fetch)
- `yarn cleanup` (clean workspace artifacts)
- `yarn dev`
- `yarn test`
- `yarn build`
- `yarn start`

## Monorepo Usage
- run commands from repository root (`JuliaApp`) unless explicitly required otherwise.
- workspace layout:
  - `apps/server` - Astro SSR shell + APIs + agent server runtime.
  - `apps/agent` - Rust agent runtime (Windows/Linux/macOS).
  - `packages/protocol` - shared protocol contract (`agent_control.proto`).
- root scripts target `@julia/server` lifecycle by default:
  - `yarn dev`, `yarn test`, `yarn build`, `yarn start`.
- protocol/agent checks:
  - `yarn check:protocol`
  - `yarn check:agent`
  - `yarn build:agent`
- explicit workspace commands when needed:
  - `yarn workspace @julia/server typecheck`
  - `yarn workspace @julia/server test`
  - `yarn workspace @julia/server build`
- if wire contract changes, update all three together:
  - `packages/protocol` + `apps/server` + `apps/agent`.

## Agent Stage-1 Notes (Implemented)
- transport between server and agent is gRPC bidi (`StreamConnect`).
- agent implementation is Rust and supports Windows/Linux/macOS binaries.
- runtime source of truth for online/offline is in-memory live connection, not DB fallback.
- runtime env access is centralized through `apps/server/src/core/env/*` (server + public providers).
- heartbeat timeout:
  - env `JULIA_AGENT_HEARTBEAT_TIMEOUT_MS` (default `60000` ms).
- gRPC bind port:
  - env `JULIA_AGENT_GRPC_PORT` (default `50051`).
- server status endpoints:
  - `GET /api/passport/agent/status`
  - `POST /api/passport/agent/status/retry`
- status enum:
  - `connected`
  - `connected_dev`
  - `unauthorized`
  - `disconnected`
- dev status mode is controlled only by:
  - `JULIAAPP_AGENT_ENABLE_DEV=1`
- transcribe production gate:
  - without online agent -> transcribe is not ready.
  - in dev bypass (`JULIAAPP_AGENT_ENABLE_DEV=1`) server path mode is allowed.
- heartbeat entries are not persisted in `agent_events` (reduced DB noise).
- server sends initial `health_ping` after first valid connect to unblock client stream startup.
- agent sends hostname in heartbeat; status API returns hostname for UI.
- shell header status badge is reactive:
  - polling + manual refresh/retry,
  - on status transition shell modules are reloaded,
  - hostname is shown in badge text.
  - polling interval is server-driven via `JULIAAPP_SHELL_STATUS_POLL_INTERVAL_MS` (default `1500` ms).

## Runtime Model
- Astro server mode with `@astrojs/node` standalone adapter.
- UI model: `Astro host + React shell`.
- index page boot path is SSR-first:
  - Astro reads shell settings/layout from `core.db` on the server,
  - initial shell state and initial clock timestamp are passed into the React island as props,
  - server HTML renders widget-card silhouettes before hydration,
  - the boot silhouette overlay is rendered outside the React island and removed only after client boot completes,
  - after hydration the silhouette state is kept for about 1 second, then live widgets are shown.
- Production entrypoint: `node ./dist/server/entry.mjs`.

Monorepo path note:
- legacy references like `src/...` in this document map to `apps/server/src/...`.

Agent startup note:
- server should be started directly (`yarn dev` / `yarn start`) without `infisical run`.
- secrets are loaded via server SDK chain on startup and cached in memory.

## Current Architecture (v1.2)
- Shell core with manifest-driven widget registry and validation.
- Passport request validation stack:
  - `zod` for endpoint contracts,
  - `drizzle-zod` for DB-derived base field schemas,
  - `neverthrow` for typed `Result` parse/mapping flow.
- Widget registration is DI-style:
  - each widget provides its own `manifest.ts`,
  - each widget exports a `register.ts`,
  - core autodiscovers registrations and never hardcodes widget render/icon wiring.
- Supported widgets now:
  - `com.yulia.transcribe`
  - `com.yulia.weather`
  - `com.yulia.terminal-agent`
- Widget contract requires:
  - `id`
  - `name`
  - `version` in `x.y.z`
  - `description`
  - `headerName: { ru, en }`
  - `icon`
  - `ready` boolean
  - sizing/capabilities/channels
- If a widget is not ready, it must not be enabled.

Shell features:
- Zustand-based shell state manager with slices for:
  - shell data,
  - settings,
  - layout,
  - drag/drop.
- drag/drop grid in Edit mode,
- `Save` and `Cancel` for layout draft,
- iOS-like wiggle animation in edit mode for widget bodies,
- overlay settings modal above the dashboard,
- localized shell UI (`ru` and `en`),
- quick locale switch in header,
- quote-of-the-day in header,
- live clock/date in header,
- theme modes:
  - `auto`
  - `day`
  - `night`
- auto-theme is resolved by local time:
  - day: `07:00-18:59`
  - night: `19:00-06:59`
- resolved theme is propagated into widgets so every widget must support both day and night presentation,
- settings panel with:
  - layout columns (`desktop/mobile`),
  - locale,
  - theme,
  - modules list (`id`, `name`, `version`, `ready/not-ready`, enable/disable).
- shell boot visual:
  - use card silhouettes, not detailed skeleton rows,
  - SSR overlay must sit above the React island, not inside it,
  - keep the highlight/pulse animation looping,
  - pulse must not move cards vertically or scale them,
  - keep silhouette geometry aligned with real widget layout and widget sizes from DB/registry.
  - boot overlay runtime logic is centralized in `apps/server/src/app/shell/ui/lib/boot-overlay.ts`.
  - boot header spacer must be measured as `JuliaHeader + ShellHeaderActions` (no extra gap math duplication).
  - boot stage must define skeleton CSS vars (`--widget-card-height-desktop`, `--radius`, `--card-bg`, `--card-shadow`) so SSR silhouettes match live cards.
- edit-mode drag placeholder must reuse the same silhouette visual language as boot loading state.
- desktop widget height rule:
  - every widget card must use fixed `min-height = max-height = height = 435px` on desktop,
  - mobile may return to adaptive height,
  - placeholder/drop-shadow slot in edit mode must follow the same desktop height.

Theme notes:
- night theme must apply to the whole page, not only shell cards,
- `html`/`body` receive current shell theme via `data-shell-theme`,
- SSR layout must also receive the resolved shell theme before hydration to avoid white flash on page load,
- initial shell clock/time SSR and first client render must share the same seeded timestamp to avoid hydration mismatch,
- global night variables live in shared global styles,
- if background stays white, check `src/shared/styles/global.scss`, `src/pages/index.astro`, `src/layouts/Layout.astro`, and theme propagation in `src/app/shell/ui/ShellApp.tsx`.
- if widgets or overlay jump on first paint, check for hydration mismatch first, especially in `src/app/shell/ui/components/ShellHeader.tsx`.
- if boot silhouettes are vertically shifted, adjust the SSR overlay spacer in `src/pages/index.astro` instead of changing live widget layout.

## API Contract
Shell APIs:
- `GET /api/shell/settings`
- `POST /api/shell/settings/layout`
- `GET /api/shell/modules`
- `POST /api/shell/modules/:id/enable`
- `POST /api/shell/modules/:id/disable`

Passport APIs:
- `POST /api/passport/agent/enroll-token/create`
- `GET /api/passport/agent/enroll-token/list`
- `POST /api/passport/agent/enroll-token/revoke`
- `POST /api/passport/agent/enroll`
- `POST /api/passport/agent/token/refresh`
- `POST /api/passport/agent/token/revoke`
- `GET /api/passport/agent/status`
- `POST /api/passport/agent/status/retry`

Widget namespace:
- `GET|POST /api/widget/:id/*`

Channels:
- `POST /api/channel/webhook/:id/:event`
- `GET|POST /api/channel/ws`

Notes:
- `/api/channel/ws` currently uses SSE-style stream transport (fallback semantics) on GET.
- channel endpoints are protected by passport JWT (`julia_access_token` cookie).
- passport agent request bodies are validated via centralized catalog:
  - `apps/server/src/domains/passport/server/validation/catalog.ts`.

## Storage Model
SQLite databases in `data/`:
- `passport.db`: agent/passport registry/sessions/tokens/enrollment
- `core.db`: shell layout/settings/module state
- `weather.db`: weather cache
- `transcribe.db`: transcription jobs/outbox state
- `llm-catalog.db`: provider model catalogs for widget consumers
- `llm-runtime.db`: consumer-based settings/dialog continuity for LLM widgets

`core.db` notes:
- `core` DB access is implemented through Drizzle ORM on top of `better-sqlite3`,
- shell settings persisted there include:
  - `desktopColumns`
  - `mobileColumns`
  - `locale`
  - `theme`

Gemini secrets source:
- no UI or DB secret storage,
- use env-based secret provider chain.

Required env vars:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-2.5-flash`)
- `AGENT_JWT_SECRET`
- `JULIAAPP_DATA_DIR` (optional)

Agent/auth related env:
- `ADMIN_TOKEN` (required for admin enroll-token API).
- `JULIA_AGENT_GRPC_PORT` (optional, default `50051`).
- `JULIAAPP_AGENT_ENABLE_DEV` (`1` enables dev bypass semantics).
- `JULIA_AGENT_HEARTBEAT_TIMEOUT_MS` (optional).
- `JULIAAPP_PROTOCOL_PROTO_PATH` (optional, explicit path to `agent_control.proto`).
- `JULIAAPP_AGENT_MOCK_MODE` (optional, enables mock fallback for transcribe only in dev bypass).
- `JULIAAPP_SHELL_STATUS_POLL_INTERVAL_MS` (optional, default `1500` ms, shell `syncFromStatus` polling interval).
- `PUBLIC_AGENT_RELEASES_BASE_URL` (optional, agent download URL base for status badge UI).

## Transcribe Flow (Current)
- user opens folder and selects one or multiple `.m4a` / `.opus` files,
- selected files are processed in exact selection order,
- `ffmpeg` merges selected inputs into one temporary source,
- merged audio is converted to compact temp mono Opus with low bitrate,
- prompt is loaded from `Transcript.md`,
- Gemini returns transcript over SSE events,
- UI renders text with typewriter effect,
- actions unlock only after reveal completes,
- output `.txt` is saved in source folder,
- job state is persisted in `transcribe.db`,
- temp files must always be deleted on success/failure.

Result actions in UI:
- `Назад`
- `Прочитать` (when matching `.txt` exists)
- `Скопировать`

Current transcribe UI notes:
- result save is automatic on the server,
- folder is refreshed after transcription completes,
- `Прочитать` opens the same result screen immediately from `.txt`, without typewriter animation,
- widget settings and path history dropdowns use shared design-system option menus,
- transcribe UI uses local Zustand slices plus shared UI primitives under `src/shared/ui`.

## Weather Flow (Current)
- source: Open-Meteo,
- fixed location: Batumi,
- cache TTL: 30 minutes,
- manual refresh available,
- fallback to cached payload on upstream failure if cache exists.

## Build / Production
- `yarn build` includes:
  - build minification (`esbuild` by default, `terser` via `JULIAAPP_BUILD_MINIFIER=terser`),
  - post-build precompression for `dist/client` (`.gz` and `.br` when smaller).
- compression is tunable via env:
  - `JULIAAPP_BUILD_COMPRESS` (`0` disables step),
  - `JULIAAPP_BUILD_COMPRESS_CONCURRENCY`,
  - `JULIAAPP_BUILD_COMPRESS_BROTLI_QUALITY`,
  - `JULIAAPP_BUILD_COMPRESS_GZIP_LEVEL`.
- raw build without compression: `yarn build:raw`.

Linting / typing:
- Biome is used for code linting/formatting policy.
- Stylelint is used for SCSS.
- Type checking runs through `astro check`.

## Engineering Rules
- for TS/TSX date/time logic use `luxon`; avoid direct `Date`, `Date.now()`, and manual `toISOString()` inside app code.
- for fallible domain/config/repository/integration flows prefer `neverthrow` `Result` over ad-hoc throw/catch chains in the middle of the flow.
- for outgoing HTTP in TS/TSX use the shared `ky`-based request layer under `apps/server/src/shared/lib/request.ts`; do not add new direct `fetch` wrappers.
- client read APIs should stay TanStack Query-ready:
  - export pure request functions,
  - export stable query keys for cacheable reads,
  - keep retry/refetch policy outside UI components.
- if a value is unknown and the operation should remain non-blocking, use `null` instead of empty strings or placeholder sentinels.
- reusable HTTP/status/protocol constants should live in shared dictionaries, not be re-declared across route files and tests.
- avoid long/cascading ternary expressions; prefer `Record` maps, named resolver helpers, or explicit branches.
- one file should have one main responsibility/exported unit; split large features by meaning, not by arbitrary line counts.
- keep feature folders decomposed by subdomain/component; each runtime TS/TSX folder should expose `index.ts` as its entrypoint where that folder is a public module boundary.
- keep `@app/*`, `@core/*`, `@shared/*`, and `@passport/*` aliases as the default cross-feature import style inside `apps/server/src`.

Container scaffold (not production-complete):
- `Containerfile`
- `podman-compose.yml`

CI container publish:
- GitHub workflow: `.github/workflows/server-release.yml`.
- publishes `apps/server` container image to GHCR:
  - `ghcr.io/<owner>/juliaapp-server:latest`
  - `ghcr.io/<owner>/juliaapp-server:sha-<commit>`
- workflow validates server before publish:
  - `yarn workspace @julia/server typecheck`
  - `yarn workspace @julia/server build`

## Removed Legacy Scope
The following legacy areas were removed from active architecture:
- chat card and `/api/chat*`
- server-control UI/API
- clean/open helper cards/APIs
- old transcribe routes outside widget namespace
- old gemini-settings json API/storage model

## Widget Local Context Files
Widget-specific local instructions live here:
- `apps/server/src/widgets/transcribe/AGENTS.md`
- `apps/server/src/widgets/transcribe/ui/AGENTS.md`
- `apps/server/src/widgets/weather/AGENTS.md`
- `apps/server/src/widgets/terminal-agent/AGENTS.md`

## Domain Local Context Files
Domain-specific local instructions live here:
- `apps/server/src/domains/passport/docs/AGENTS.md`
- `apps/server/src/domains/llm/docs/AGENTS.md`

## Operational Notes
- after frontend/API changes, rebuild on Windows before production check,
- in active UI iteration use `yarn dev` on Windows,
- if page looks stale, suspect browser cache or old `dist`,
- for style staleness use hard refresh (`Ctrl+F5`).

## Safety Rules
- do not commit or expose real Gemini API key,
- do not publish `data/*.db` contents,
- keep Windows path and port stable unless intentional migration,
- preserve temporary audio cleanup behavior,
- preserve SSE event contract unless frontend and backend are updated together.
