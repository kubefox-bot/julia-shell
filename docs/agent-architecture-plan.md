# Agent Architecture Plan (Server + Windows Agent)

Last updated: 2026-03-08  
Status: Draft v2 (agent-first concept)

## 1) Summary

Goal:
- move local Windows operations (FS, ffmpeg, Gemini calls) to a dedicated Windows agent;
- keep widget-facing API stable (`/api/widget/:id/*` + existing SSE behavior);
- make agent availability mandatory for operational widget flows.

Core decisions for current implementation:
- build a monorepo with three projects: `server`, `agent`, `protocol`;
- implement one production phase first (`Phase A: Agent-first MVP`);
- use gRPC + Protobuf for server-agent control channel;
- use separate `agent.db` and baseline JWT auth from day one;
- postpone command dedup/idempotency and autonomous self-update to later phases.

## 2) Target Architecture

### 2.1 Runtime topology

- `apps/server`:
  - Astro UI + widget APIs;
  - Agent Control Core (sessions, jobs, bridge);
  - persistence in `core.db` + `agent.db`.
- `apps/agent-windows` (Rust service):
  - connector runtime;
  - v1 connectors: `health`, `transcribe`;
  - local execution of `ffmpeg` and Gemini requests.
- `packages/protocol`:
  - protobuf schemas;
  - generated TS/Rust artifacts;
  - protocol versioning rules.
- Traefik:
  - TLS termination;
  - HTTP/2 routing for gRPC;
  - route isolation for `/api/agent/*`.

### 2.2 Compatibility boundary

- browser/UI keeps using:
  - `/api/widget/:id/*`,
  - `/api/channel/ws` SSE fallback stream.
- no direct browser-to-agent calls.
- transcribe widget handlers become orchestration layer over agent jobs.

### 2.3 Operational policy (agent required)

- server considers agent as required runtime dependency for transcribe flow;
- production mode (`NODE_ENV=production`): when no online/authorized agent session exists:
  - transcribe jobs are not started,
  - API returns controlled `agent_offline` error,
  - shell/widget can show non-operational state.
- development mode (`NODE_ENV=development`): strict gate is disabled; site is available with a mock agent for developer workflows.
- no local real transcribe fallback in production for Phase A.

## 3) Monorepo Structure

Use Yarn workspaces while preserving Yarn 4 setup.

Proposed layout:
- `apps/server` (current Astro project moved/adapted);
- `apps/agent-windows` (Rust project);
- `packages/protocol` (protobuf schemas + generated artifacts).

Minimum workspace requirements:
- root `package.json` contains workspaces;
- CI jobs split by workspace (`server`, `protocol`, `agent`);
- protobuf generation scripts are deterministic and version-pinned.

## 4) Agent Control Core (Server)

### 4.1 Responsibilities (Phase A scope)

One central server module handles:
- **Signal Ingest**: receives agent events (`progress`, `token`, `done`, `error`, `health`);
- **Session Manager**: `connected`, `heartbeat`, `disconnected`, `expired`;
- **Auth Manager**: enrollment, JWT validation, refresh token rotation;
- **Job Manager**: `queued -> running -> done|error|timeout|canceled`;
- **Widget Event Bridge**: maps agent events to existing widget SSE contract.

Explicitly out of scope in Phase A:
- command dedup / replay-safe idempotency;
- update state manager and rollout orchestration.

### 4.2 Storage model (separate DBs)

Use two SQLite databases:
- `data/core.db` (business/widget runtime state),
- `data/agent.db` (agent identity, sessions, auth, event log).

`agent.db` minimum tables:
- `agent_registry`
  - `agent_id` (PK), `display_name`, `status`, `capabilities_json`, `version`, `created_at`, `updated_at`.
- `agent_sessions`
  - `session_id` (PK), `agent_id`, `status`, `connected_at`, `last_heartbeat_at`, `disconnected_at`, `disconnect_reason`.
- `agent_tokens`
  - `id` (PK), `agent_id`, `token_type` (`refresh`), `token_hash`, `issued_at`, `expires_at`, `revoked_at`.
- `agent_events`
  - `id` (PK), `agent_id`, `session_id`, `job_id`, `event_type`, `payload_json`, `received_at`.

`core.db` minimum tables:
- `agent_jobs`
  - `job_id` (PK), `widget_id`, `agent_id`, `session_id`, `state`, `error_code`, `error_message`, `created_at`, `updated_at`.

Notes:
- timestamps in UTC ISO format;
- `payload_json` stored as text JSON;
- indexes on `agent_id`, `session_id`, `job_id`, `received_at`, `expires_at`.

### 4.3 Event bridge contract

Internal normalized event shape:
- `topic` (e.g. `agent:transcribe:{jobId}`),
- `source` (`agent/{agentId}`),
- `eventType`,
- `payload`,
- `timestamp`.

Bridge behavior:
- ingest event -> validate -> persist -> publish into `moduleBus`;
- widget-facing SSE stays unchanged and receives mapped events (`progress/token/done/error`).

## 5) Server ↔ Agent Protocol (gRPC + Protobuf)

### 5.1 Phase A protocol scope

Define in `packages/protocol/proto/agent_control.proto`:
- `AgentControlService.Connect(stream AgentEnvelope) returns (stream ServerEnvelope)`;
- command/event types only for:
  - `health`,
  - `transcribe.start`,
  - `transcribe.cancel`,
  - `progress/token/done/error`.

Core envelope fields:
- `protocol_version`,
- `agent_id`,
- `session_id`,
- `job_id`,
- `timestamp`.

Reserved for future compatibility:
- keep optional `command_id` field in schema, but no dedup enforcement in Phase A.

### 5.2 Protocol version policy

- every envelope must include `protocol_version`;
- server supports one current protocol version in Phase A;
- incompatible version returns typed error and session is rejected.

## 6) Authentication & Trust (Phase A)

### 6.1 Identity model

- agent identity starts from one-time enrollment token;
- on successful enrollment server issues:
  - `agent_id`,
  - `refresh_token`,
  - short-lived `access_jwt`.
- operational control channel requires `access_jwt`;
- refresh endpoint rotates refresh token.

### 6.2 Server API (HTTP, JSON)

- `POST /api/agent/enroll`
  - request: `enrollment_token`, `device_info`, `agent_version`, `capabilities`;
  - response: `agent_id`, `access_jwt`, `refresh_token`, `expires_in`.
- `POST /api/agent/token/refresh`
  - request: `agent_id`, `refresh_token`;
  - response: rotated `access_jwt`, rotated `refresh_token`, `expires_in`.
- `POST /api/agent/token/revoke`
  - request: `agent_id`, `refresh_token`;
  - response: `revoked: true`.

Agent control ingress:
- `POST /api/agent/grpc` (Traefik route to gRPC service; browser never calls it).

Security hygiene:
- refresh tokens stored hashed only;
- no plaintext auth tokens in logs/DB payloads.

### 6.3 Token storage policy

- `access_jwt`:
  - short-lived token for control channel;
  - stored in agent process memory only;
  - never persisted to disk.
- `refresh_token`:
  - persisted on agent host in secure Windows storage (DPAPI/Credential Manager);
  - never written to plaintext config files;
  - rotated on every refresh call.
- server persistence:
  - store only `hash(refresh_token)` and metadata in `agent.db`;
  - never store raw refresh/access token values.

### 6.4 Authorization lifecycle (install -> runtime)

1. Agent starts with one-time `enrollment_token`.
2. Agent calls `POST /api/agent/enroll`.
3. Server returns `agent_id`, `access_jwt`, `refresh_token`, `expires_in`.
4. Agent stores only `refresh_token` in secure Windows storage.
5. Agent opens/maintains gRPC stream using `access_jwt`.
6. Before access expiry agent calls `POST /api/agent/token/refresh`.
7. Server rotates refresh token and returns new token pair.
8. Agent updates secure storage with the new `refresh_token` and keeps working.

Restart behavior:
- on restart, agent loads stored `refresh_token`, requests fresh `access_jwt`, and reconnects;
- if refresh is revoked/expired, agent cannot connect and must re-enroll.

Environment behavior:
- production: full JWT flow is mandatory;
- development: mock-agent mode may bypass live token flow.

## 7) Rust Agent (Phase A)

### 7.1 Agent runtime

- Windows service process;
- reconnect loop and heartbeat;
- structured logs;
- command dispatcher for one active transcribe job.

### 7.2 Connectors in Phase A

- `connector.health`
  - `ping`, `version`, `capabilities`.
- `connector.transcribe`
  - validate selection;
  - merge/convert audio via `ffmpeg`;
  - call Gemini;
  - save `.txt`;
  - cleanup temp files on success/failure/cancel.

### 7.3 Safety constraints

- hard path allowlist (e.g. `C:\Users\julia\OneDrive`);
- no arbitrary command execution;
- cancellation must terminate child processes and cleanup temp artifacts.

## 8) Phases

### Phase A (current, implementation target)

Single end-to-end delivery phase:
- migrate to monorepo: `apps/server` + `apps/agent-windows` + `packages/protocol`;
- implement server Agent Control Core with sessions/jobs/bridge;
- implement separate `agent.db` and baseline JWT auth;
- implement Windows agent runtime (`health` + `transcribe`);
- route transcribe widget flow through agent;
- enforce environment-based policy:
  - production: `agent required`;
  - development: mock-agent mode allowed.

Definition of done:
- transcribe E2E works via agent with existing widget SSE contract;
- in production, when agent is offline, transcribe API returns controlled `agent_offline` error;
- in development, site boots and widget flows can run with mock-agent mode;
- temp file cleanup is preserved on success/failure/cancel;
- CI passes for `server`, `protocol`, `agent`.

### Phase B (planned next)

- command dedup/idempotency (`command_id` enforcement);
- richer reconnect semantics and replay handling;
- multi-agent routing/scheduling.

### Phase C (planned later)

- autonomous agent self-update;
- signed artifacts, canary rollout, rollback automation;
- version policy gates (`min_supported_version`, maintenance modes).

## 9) Testing Strategy

Contract:
- protobuf compatibility tests between TS and Rust artifacts.

Security:
- enrollment token validation;
- invalid/expired JWT rejection;
- refresh rotation and revoked-token rejection;
- no-plaintext-token persistence checks.

Session/job:
- connect, heartbeat, reconnect;
- transcribe lifecycle: `queued -> running -> done/error/timeout/canceled`.

Integration:
- transcribe job path: command -> progress/token -> done/error -> widget SSE mapping.

Failure:
- agent offline before job start (`agent_offline`);
- agent disconnect during active job (`agent_disconnect`);
- ffmpeg/gemini failures are mapped to stable error codes.

## 10) CI/CD Notes

CI (mandatory):
- workspace checks for `server` (`lint`, `typecheck`, `test`, `build`);
- protocol generation determinism check;
- Rust agent build/test on Windows runner.

CD:
- remains a next step after Phase A stabilization.

## 11) Operational Rollback

Emergency rollback target in this version:
- temporary switch back to local transcribe path is implementation-defined and not default;
- normal mode remains agent-required.

Note:
- once local fallback exists as an emergency path, it must be guarded by explicit runtime flag and disabled by default.
