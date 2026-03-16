# Client Optimization + Local Widget Packages Plan

Last updated: 2026-03-09  
Status: Draft v1 (execution-ready)

## 1) Summary

Goal:
- reduce initial client runtime/bundle cost without breaking current Shell-Core v1.2 UX;
- migrate widgets to local monorepo workspace packages that behave like npm packages;
- keep one repository and one release pipeline (no split repos, no external npm publish).

Core decisions:
- work in incremental compatibility mode (no big-bang migration);
- keep runtime model unchanged: Astro server mode + Node standalone adapter;
- keep deployment endpoints and ports unchanged (`:4321` HTTP, `:50051` gRPC).

## 2) Baseline Metrics (must be captured first)

Capture before any optimization work:
- initial JS payload (gz and raw) for `/`;
- number of initial JS chunks loaded on first paint;
- first-load timings (TTFB, FCP, LCP, TTI proxy).

Baseline command set:
- `yarn workspace @julia/server build`
- static bundle inspection over `apps/server/dist/client`
- browser measurement on Windows target host (`http://192.168.100.102:4321`)

Record template:

| Metric | Baseline | Target | Notes |
|---|---:|---:|---|
| Initial JS (raw) |  |  |  |
| Initial JS (gz) |  |  |  |
| Initial chunk count |  |  |  |
| FCP |  |  |  |
| LCP |  |  |  |
| TTI proxy |  |  |  |

## 3) Client Optimization Phases

### Phase C1 — Hydration and boot critical path

Objective:
- keep SSR-first shell behavior while reducing immediate hydration weight.

Checklist:
- [ ] Owner: FE — separate critical shell boot path from non-critical startup work.
- [ ] Owner: FE — defer non-critical fetches (agent status/background reads) until after first paint.
- [ ] Owner: FE — keep SSR skeleton/overlay behavior identical to current UX constraints.
- [ ] Owner: QA — verify no hydration mismatch in header clock/theme/overlay removal.

Done criteria:
- no regressions in boot visuals and hydration stability;
- measurable reduction in first-render blocking client work.

### Phase C2 — Widget-level code splitting

Objective:
- ensure heavy widget code is not part of the initial route payload unless rendered/needed.

Checklist:
- [ ] Owner: FE — lazy-load heavy widget render modules (starting with transcribe).
- [ ] Owner: FE — ensure weather/transcribe bundles are isolated as separate chunks.
- [ ] Owner: FE — preserve edit mode, DnD, and widget card behavior after lazy boundaries.
- [ ] Owner: QA — validate first-load bundle does not include transcribe-heavy runtime by default.

Done criteria:
- initial JS payload reduced from baseline;
- heavy widget chunks are loaded on demand.

### Phase C3 — Zustand render pressure reduction

Objective:
- remove avoidable rerenders in shell and widget containers.

Checklist:
- [ ] Owner: FE — tighten selectors and subscription granularity in shell root and grid containers.
- [ ] Owner: FE — avoid broad store reads in high-frequency components.
- [ ] Owner: QA — compare interaction smoothness in edit mode and widget actions.

Done criteria:
- fewer redundant renders in profiling;
- no behavior regressions in shell settings/layout flows.

### Phase C4 — Legacy runtime surface cleanup

Objective:
- reduce duplicate execution paths and simplify client/runtime behavior.

Checklist:
- [ ] Owner: BE — close old non-widget `/api/*` paths not in active v1.2 contract.
- [ ] Owner: BE — keep explicit deprecation responses for temporary compatibility where needed.
- [ ] Owner: FE — remove any direct client usage of legacy endpoints.
- [ ] Owner: QA — confirm all active flows use `/api/widget/:id/*` and shell APIs only.

Done criteria:
- single canonical API surface for active features;
- no legacy endpoint dependency in current UI.

## 4) Widget Workspace Packaging Phases

## 4.1 Target package model

Create monorepo-local widget packages:
- `packages/widget-weather`
- `packages/widget-transcribe`

Each package exports:
- `registerWidget()`;
- client/server registration entrypoints compatible with existing Shell-Core widget contracts.

Dependency strategy:
- consume via `workspace:*`;
- no external npm publishing required.

## 4.2 Migration steps (incremental with compatibility)

### Phase W0 — Packaging infrastructure

Checklist:
- [ ] Owner: BE — add package scaffolds with independent `package.json` and typed exports.
- [ ] Owner: BE — wire workspace dependencies from `@julia/server` to widget packages.
- [ ] Owner: BE — define explicit registration map in server app (deterministic package imports).

Done criteria:
- server resolves widget modules from workspace packages without changing runtime behavior.

### Phase W1 — Weather migration (low risk first)

Checklist:
- [ ] Owner: BE/FE — move weather widget implementation into `packages/widget-weather`.
- [ ] Owner: BE — keep temporary adapter in `apps/server/src/widgets/weather/*` re-exporting package entrypoints.
- [ ] Owner: QA — verify forecast/refresh/cache behavior and module readiness/enabling.

Done criteria:
- weather feature parity confirmed;
- no contract change for shell/widget API consumers.

### Phase W2 — Transcribe migration (higher complexity)

Checklist:
- [ ] Owner: BE/FE — move transcribe widget implementation into `packages/widget-transcribe`.
- [ ] Owner: BE — preserve SSE contract and temp file cleanup invariants.
- [ ] Owner: QA — full transcribe regression: selection order, progress, done/error, `.txt` save/read.

Done criteria:
- transcribe parity confirmed in both agent-required and dev-bypass modes.

### Phase W3 — Adapter removal and hardening

Checklist:
- [ ] Owner: BE — remove temporary compatibility adapters under `apps/server/src/widgets/*`.
- [ ] Owner: BE — ensure registry imports only workspace packages.
- [ ] Owner: QA — final end-to-end smoke across shell + widgets + agent status transitions.

Done criteria:
- clean package-based widget boundary with no duplicate source-of-truth.

## 5) Public Interfaces and Type Boundary Updates

Required updates:
- widget registration/import boundary moves from filesystem-glob-only discovery to explicit package registration map;
- package-level exports reuse existing widget contract types from server core (no schema fork);
- external HTTP/SSE contracts remain stable during migration.

Compatibility policy:
- no breaking route or payload changes for:
  - `/api/shell/*`
  - `/api/widget/:id/*`
  - transcribe SSE event contract.

## 6) Test and Validation Plan

Per phase required checks:
- `yarn workspace @julia/server typecheck`
- `yarn workspace @julia/server test`
- `yarn workspace @julia/server build`

Runtime validation matrix:
- shell boot + settings overlay + drag/drop/edit mode;
- weather widget forecast/refresh/fallback cache;
- transcribe full flow (`.m4a`/`.opus`, selection order, SSE progress/token/done, `.txt` save/read, temp cleanup);
- agent status transitions (`connected`, `unauthorized`, `disconnected`) with UI badge updates.

Performance validation:
- compare metrics against baseline table from Section 2;
- confirm heavy widget code absence from first-load bundle unless required.

## 7) Rollout and Rollback

Rollout order:
1. C1 + C2 (client boot/code splitting),
2. W0 + W1 (package infra + weather),
3. W2 (transcribe package migration),
4. C3 + C4 + W3 (render tuning, legacy cleanup, adapter removal).

Rollback strategy:
- keep migration in small PR batches (one phase per merge window);
- if regression appears, revert only the last phase batch and keep prior stable phases;
- do not change target host URL/path/ports during this initiative.

## 8) Acceptance Criteria

Project-level acceptance:
- baseline and post-change metrics documented and compared;
- first-load client payload reduced vs baseline;
- no regression in shell SSR boot behavior and widget runtime behavior;
- widget packaging completed in monorepo workspaces without separate repos;
- all required checks pass on server workspace.

## 9) Assumptions

- This document is standalone and does not modify existing architecture plan docs.
- Deployment continues on Windows target host as runtime source of truth.
- Runtime model stays Astro server mode (`@astrojs/node` standalone adapter).
- Network ports and host paths remain unchanged unless explicitly requested later.
