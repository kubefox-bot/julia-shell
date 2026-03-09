# Bun Monorepo Migration Plan

## Goals
- make Bun (`1.3.7`) the canonical package manager for the monorepo;
- run server workspace lifecycle through Bun locally and in CI/CD;
- keep existing HTTP/API contracts and widget behavior unchanged;
- keep rollback path to Node runtime for emergency production recovery.

## Non-Goals
- no public API/schema changes;
- no refactor of widget/domain internals;
- no changes to Rust packaging/release flow beyond dependency trigger paths.

## Migration Phases

### P0 - Baseline alignment
- set root `packageManager` to `bun@1.3.7`;
- move workspace scripts to `bun run --filter ...`;
- remove Yarn-specific script chaining in workspaces;
- establish `bun.lock` as the canonical lockfile;
- remove `.yarnrc.yml` from repo.

### P1 - Build/runtime parity
- keep Astro adapter/runtime behavior unchanged;
- set server start command to `bun ./dist/server/entry.mjs`;
- keep `start:node` fallback script for rollback operations;
- validate local parity:
  - `bun run dev`
  - `bun run test`
  - `bun run build`
  - `bun run start`

### P2 - CI adaptation
- update PR validation workflow to Bun setup and Bun dependency cache;
- run quality gates in PR workflow:
  - server lint/typecheck/test/build
  - protocol check
  - agent check
- add lockfile drift fail-fast step (`git diff --exit-code -- bun.lock`).

### P3 - CD adaptation
- update server release workflow to Bun install and Bun validation;
- build/push container image from Bun-based `Containerfile`;
- add post-deploy smoke stage with gating:
  - `/`
  - `/api/passport/agent/status`
  - `/api/shell/settings`
  - `/api/widget/com.yulia.weather/forecast`
- deployment succeeds only when image push and smoke stage are green.

### P4 - Operations/documentation
- update project docs to Bun-first commands;
- document fallback/rollback and CI/CD migration marker;
- keep migration observability in workflow summary (bun version, lock hash, durations, smoke statuses).

## CI/CD Adaptation Matrix

| Pipeline | Before | After | Gate |
|---|---|---|---|
| `server-pr-checks.yml` | Node + Yarn + Corepack | Bun setup + `bun install --frozen-lockfile` | lockfile drift + all checks green |
| `server-release.yml` | Docker-only publish flow | Bun validation + Docker publish + smoke checks | publish + smoke green |
| `agent-pr-checks.yml` | path trigger on `yarn.lock`/`.yarnrc.yml` | path trigger on `bun.lock` | Rust checks green |

## Risk Register
- Native/runtime dependency mismatch (`better-sqlite3`, grpc stack) under Bun runtime.
- CI cache cold-start regressions after lockfile switch.
- Smoke endpoint false negatives due auth-gated routes.

## Mitigations
- keep `start:node` fallback script in server workspace;
- use explicit allowed status matrix for auth-gated smoke routes;
- log Bun metadata and smoke result codes to deploy summary.

## Rollback Playbook
1. Runtime fallback: use `bun run --filter @julia/server start:node`.
2. CI/CD rollback: revert workflow files to last green commit.
3. Lockfile rollback: restore previous lockfile commit if Bun lock introduces blocker.
4. Incident ownership: release owner performs rollback, posts summary, and opens follow-up task.

## Acceptance Criteria
- root/workspace lifecycle commands execute via Bun only;
- `bun.lock` exists and is enforced in CI;
- PR checks include server + protocol + agent Bun-driven gates;
- release workflow publishes image and blocks on smoke failures;
- docs reflect Bun-first operation and rollback path.
