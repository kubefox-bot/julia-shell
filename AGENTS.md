# AGENTS.md

Last updated: 2026-03-08

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

## Package Manager
- package manager: `Yarn 4`
- linker: `node-modules`
- Windows command path usually via `corepack.cmd`

Useful commands:
- `yarn install`
- `yarn dev`
- `yarn test`
- `yarn build`
- `yarn start`

## Runtime Model
- Astro server mode with `@astrojs/node` standalone adapter.
- UI model: `Astro host + React shell`.
- index page boot path is SSR-first:
  - Astro reads shell settings/layout from `core.db` on the server,
  - initial shell state is passed into the React island as props,
  - server HTML renders widget-card silhouettes before hydration,
  - after hydration the silhouette state is kept for about 1 second, then live widgets are shown.
- Production entrypoint: `node ./dist/server/entry.mjs`.

## Current Architecture (v1.2)
- Shell core with manifest-driven widget registry and validation.
- Widget registration is DI-style:
  - each widget provides its own `manifest.ts`,
  - each widget exports a `register.ts`,
  - core autodiscovers registrations and never hardcodes widget render/icon wiring.
- Supported widgets now:
  - `com.yulia.transcribe`
  - `com.yulia.weather`
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
  - keep the short highlight/pulse animation,
  - keep silhouette geometry aligned with real widget layout and widget sizes from DB/registry.
- desktop widget height rule:
  - every widget card must use fixed `min-height = max-height = height = 435px` on desktop,
  - mobile may return to adaptive height,
  - placeholder/drop-shadow slot in edit mode must follow the same desktop height.

Theme notes:
- night theme must apply to the whole page, not only shell cards,
- `html`/`body` receive current shell theme via `data-shell-theme`,
- SSR layout must also receive the resolved shell theme before hydration to avoid white flash on page load,
- global night variables live in shared global styles,
- if background stays white, check `src/shared/styles/global.scss`, `src/pages/index.astro`, `src/layouts/Layout.astro`, and theme propagation in `src/app/shell/ui/ShellApp.tsx`.

## API Contract
Shell APIs:
- `GET /api/shell/settings`
- `POST /api/shell/settings/layout`
- `GET /api/shell/modules`
- `POST /api/shell/modules/:id/enable`
- `POST /api/shell/modules/:id/disable`

Widget namespace:
- `GET|POST /api/widget/:id/*`

Channels:
- `POST /api/channel/webhook/:id/:event`
- `GET|POST /api/channel/ws`

Notes:
- `/api/channel/ws` currently uses SSE-style stream transport (fallback semantics) on GET.
- channel endpoints are protected by `X-Widget-Token`.

## Storage Model
SQLite databases in `data/`:
- `core.db`: shell layout/settings/module state
- `weather.db`: weather cache
- `transcribe.db`: transcription jobs/outbox state

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
- `WIDGET_CHANNEL_TOKEN`
- `JULIAAPP_DATA_DIR` (optional)

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
  - production minification (Terser),
  - post-build precompression for `dist/client` (`.gz` and `.br` when smaller).
- raw build without compression: `yarn build:raw`.

Linting / typing:
- Biome is used for code linting/formatting policy.
- Stylelint is used for SCSS.
- Type checking runs through `astro check`.

Container scaffold (not production-complete):
- `Containerfile`
- `podman-compose.yml`

## Removed Legacy Scope
The following legacy areas were removed from active architecture:
- chat card and `/api/chat*`
- server-control UI/API
- clean/open helper cards/APIs
- old transcribe routes outside widget namespace
- old gemini-settings json API/storage model

## Widget Local Context Files
Widget-specific local instructions live here:
- `src/widgets/transcribe/AGENTS.md`
- `src/widgets/transcribe/ui/AGENTS.md`
- `src/widgets/weather/AGENTS.md`

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
