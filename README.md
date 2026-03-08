# JuliaApp Monorepo

Stage 1 monorepo layout:

- `apps/server` - Astro SSR shell + widget APIs + agent control core.
- `apps/agent` - Rust agent runtime (Linux/macOS/Windows).
- `packages/protocol` - gRPC/protobuf contracts.

## Monorepo usage

All commands are run from repository root: `/Users/evgeniyscherbina/WORKING/PET/JuliaApp`.

Typical flow:
1. Install deps once: `yarn install`
2. Develop server UI/API: `yarn dev`
3. Check contracts: `yarn check:protocol`
4. Check agent build: `yarn check:agent`
5. Run server tests: `yarn test`
6. Build server: `yarn build`

## Workspace commands

```bash
yarn install

yarn dev            # @julia/server dev
yarn build          # @julia/server build
yarn test           # @julia/server tests

yarn check:protocol # proto syntax/check

yarn check:agent    # cargo check (apps/agent)
yarn build:agent    # cargo build (apps/agent)

# explicit workspace calls (optional)
yarn workspace @julia/server dev
yarn workspace @julia/server typecheck
yarn workspace @julia/server test
yarn workspace @julia/server build
```

## Repo responsibilities

- `apps/server`: Astro shell, HTTP APIs, gRPC ingress, SQLite DB files under configured data dir.
- `apps/agent`: Rust cross-platform agent (Windows/Linux/macOS).
- `packages/protocol`: `agent_control.proto` and protocol checks/codegen inputs.

## Data path (Podman)

Server runtime data is expected under host path:

- `/mnt/ostree/podman/julia-shell`

See `apps/server/podman-compose.yml` for bind mounts and env vars.

## Agent Status and Runtime Notes

- Agent status API:
  - `GET /api/agent/status`
  - `POST /api/agent/status/retry`
- Status enum:
  - `connected`
  - `connected_dev`
  - `unauthorized`
  - `disconnected`
- `connected_dev` is controlled by server env:
  - `JULIAAPP_AGENT_ENABLE_DEV=1`
- Shell status badge is reactive and reloads shell modules on every status transition.
- Transcribe ready/not-ready state is evaluated dynamically from widget `init()` on each modules read (not frozen in old registry cache).

## Agent Healthcheck and Session Model

- Live online/offline is memory-based (active gRPC connection), not DB fallback.
- Heartbeat timeout is configurable:
  - `JULIA_AGENT_HEARTBEAT_TIMEOUT_MS` (default `60000` ms).
- On timeout server marks connection as disconnected and closes stale stream.
- Heartbeat events are not persisted into `agent_events` anymore.
- DB is used for audit/state (`agent_sessions`, jobs/events) but not as source of truth for current online status.

## Hostname in UI

- Agent sends hostname in heartbeat (`Heartbeat.hostname` in proto).
- Server includes hostname in `/api/agent/status`.
- Header `AgentStatusBadge` shows hostname text after action button.
- If no hostname is available from env (`HOSTNAME`/`COMPUTERNAME`), agent uses `unknown-host`.

## Local Run (Server + Agent)

From repository root:

```bash
# 1) server
yarn dev

# 2) agent (new terminal)
cd apps/agent
cp .env.example .env
./start-agent.sh
# or on Windows PowerShell:
# ./start-agent.ps1
```

Optional agent env vars:
- `JULIA_AGENT_SERVER_URL` (default `http://127.0.0.1:4321`)
- `JULIA_AGENT_GRPC_ENDPOINT` (default `http://127.0.0.1:50051`)
- `JULIA_AGENT_ENROLLMENT_TOKEN` (only for first enroll or forced re-enroll)
- `JULIA_AGENT_DISPLAY_NAME` (overrides hostname sent to server)
- `JULIA_AGENT_REFRESH_TOKEN_PATH`

Agent start scripts:
- `apps/agent/start-agent.sh` reads `apps/agent/.env`, exports vars, and starts:
  - `./julia-agent`, then
  - `./target/release/julia-agent`, then
  - `./target/debug/julia-agent`,
  - fallback to `cargo run` if binary is missing.
- `apps/agent/start-agent.ps1` does the same flow for Windows (`.exe` paths).

## Agent Release Artifacts

GitHub Actions workflow:
- `.github/workflows/agent-publish.yml`

Published assets:
- `julia-agent-windows-x64.zip` (portable)
- `julia-agent-windows-x64-installer.exe` (installer)
- `julia-agent-macos-arm64.tar.gz` (portable)
- `julia-agent-macos-arm64.zip` (portable)
- `julia-agent-macos-arm64.pkg` (installer)
- `julia-agent-linux-x64.tar.gz` (portable)
- `julia-agent-linux-x64.zip` (portable)
- `julia-agent-linux-x64.deb`
- `julia-agent-linux-x64.rpm`

## CI Server Release

GitHub Actions workflow:
- `.github/workflows/server-release.yml`

Behavior:
- triggers on `main` push and manual run (`workflow_dispatch`);
- runs server validation (`typecheck` + `build`);
- builds and pushes image to GHCR:
  - `ghcr.io/<owner>/juliaapp-server:latest`
  - `ghcr.io/<owner>/juliaapp-server:sha-<commit>`

Container definition:
- `apps/server/Containerfile`
- build context root with `.dockerignore`.
