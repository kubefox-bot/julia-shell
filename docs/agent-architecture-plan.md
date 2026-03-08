# Agent Architecture Plan (Server + Rust Agent)

Last updated: 2026-03-08  
Status: Draft v1 (implementation-oriented)

## 1) Summary

Goal:
- move Astro host to a dedicated server behind Traefik/Podman;
- keep Windows-local operations (FS access, ffmpeg, gemini-cli) on Yulia PC via a modular Rust agent;
- keep widget-facing API stable (`/api/widget/:id/*` + existing SSE behavior).

Core decisions:
- add a single **Agent Control Core** in server-side `core` (signals, sessions, auth, bus bridge);
- use **gRPC + Protobuf** for server-agent communication;
- use **JWT-only agent auth** (enrollment + refresh/access + replay protection);
- support autonomous **agent self-update** with signed artifacts and rollback;
- use **Infisical only as secret provider**, not as identity provider.

## 2) Target Architecture

### 2.1 Runtime topology

- `apps/server`:
  - Astro UI + widget APIs;
  - Agent Control Core;
  - DB persistence and widget event bridge.
- `apps/agent-windows` (Rust service):
  - connector runtime;
  - local connectors (`health`, `fs`, `transcribe`);
  - local execution of `ffmpeg` and `gemini-cli`.
- Traefik:
  - TLS termination;
  - HTTP/2 routing for gRPC;
  - route isolation and TLS for `/api/agent/*`.

### 2.2 Compatibility boundary

- browser/UI keeps using:
  - `/api/widget/:id/*`,
  - `/api/channel/ws` SSE fallback stream.
- no direct browser-to-agent calls.
- transcribe widget handlers become orchestration layer over agent jobs.

## 3) Monorepo Structure

Use Yarn workspaces while preserving existing package manager setup.

Proposed layout:
- `apps/server` (existing project moved/adapted);
- `apps/agent-windows` (Rust project);
- `packages/protocol` (protobuf schemas + generated artifacts);
- `packages/security` (shared JWT/replay policy helpers for server).

Minimum workspace requirements:
- root `package.json` contains workspaces;
- CI jobs split by workspace (`server`, `protocol`, `agent`);
- protobuf generation scripts are deterministic and version-pinned.

## 4) Agent Control Core (Server)

## 4.1 Responsibilities

One central server module handles:
- **Signal Ingest**: receives agent events (`progress`, `done`, `error`, `log`, `health`);
- **Session Manager**: `connected`, `heartbeat`, `expired`, `revoked`;
- **Auth Manager**: enrollment, JWT validation, token rotation, replay defense;
- **Widget Event Bridge**: normalizes events and publishes them into internal bus for widget pipelines.
- **Update State Manager**: tracks agent version drift and update-required signals.

## 4.2 Storage model (separate DBs)

Use two SQLite databases:
- `data/agent-auth.db` (security/session source of truth),
- `data/core.db` (business/runtime source of truth).

`agent-auth.db` tables:
- `agent_registry`
  - `agent_id` (PK), `display_name`, `status`, `capabilities_json`, `version`, `created_at`, `updated_at`.
- `agent_refresh_tokens`
  - `id` (PK), `agent_id`, `token_hash`, `issued_at`, `expires_at`, `rotated_from_id`, `revoked_at`, `revoke_reason`.
- `agent_jti_replay`
  - `jti` (PK), `agent_id`, `expires_at`, `seen_at`.
- `agent_revocations`
  - `id` (PK), `agent_id`, `subject_type` (`refresh`/`session`), `subject_id`, `reason`, `created_at`.
- `agent_auth_audit`
  - `id` (PK), `agent_id`, `event_type`, `payload_json`, `created_at`.

`core.db` tables:
- `agent_sessions`
  - `session_id` (PK), `agent_id`, `status`, `connected_at`, `last_heartbeat_at`, `expired_at`, `revoked_at`, `disconnect_reason`.
- `agent_events`
  - `id` (PK), `agent_id`, `session_id`, `job_id`, `event_type`, `payload_json`, `received_at`.
- `agent_job_links`
  - `job_id` (PK), `widget_id`, `agent_id`, `session_id`, `state`, `command_id`, `created_at`, `updated_at`.
- `agent_update_state`
  - `agent_id` (PK), `current_version`, `target_version`, `update_required`, `reason`, `notified_at`, `acknowledged_at`, `updated_at`.

Notes:
- timestamps in UTC ISO format;
- `payload_json` stored as text JSON;
- scheduled cleanup for expired `agent_jti_replay` rows;
- indexes on `agent_id`, `session_id`, `job_id`, `received_at`, `expires_at`.

## 4.3 Event bridge contract

Internal normalized event shape:
- `topic` (e.g. `agent:transcribe:{jobId}`),
- `source` (`agent/{agentId}`),
- `eventType`,
- `payload`,
- `timestamp`.

Bridge behavior:
- ingest event -> validate -> persist -> publish into `moduleBus`;
- widget-facing SSE stays unchanged and receives mapped events.
- update-related agent signals are published to dedicated topics (e.g. `agent:update:{agentId}`) so widgets/shell can show maintenance state.

## 5) Server ↔ Agent Protocol (gRPC + Protobuf)

## 5.1 Why gRPC/protobuf here

Benefits:
- strict typed contract shared by Rust and TS;
- compact payloads for progress-heavy flows;
- native streaming for long-running jobs;
- explicit schema evolution/versioning.

Costs:
- more setup (toolchain, observability, debugging);
- not browser-facing (kept server-side only).

Conclusion for v1:
- use gRPC/protobuf for server-agent channel;
- keep HTTP/SSE for browser APIs.

## 5.2 Traefik compatibility

Traefik can proxy gRPC over HTTP/2.  
For internal plaintext gRPC, use h2c routing between Traefik and server container.

Mandatory config outcomes:
- TLS + HTTP/2 enabled on edge;
- agent routes exposed only over TLS;
- route isolation for `/api/agent/*`.

## 5.3 Protobuf contracts (v1)

Define in `packages/protocol/proto/agent_control.proto`:
- `AgentConnect` bi-directional stream;
- `CommandDispatch`;
- `AgentEvent`;
- `EventAck`.
- include update event/command messages:
  - `AgentUpdateSignal` (agent -> server: update required/available),
  - `AgentUpdateAcknowledge` (server -> agent: signal accepted),
  - `AgentUpdateInstruction` (server -> agent: target version/check window),
  - `AgentUpdateReady` (agent -> server: update package downloaded and verified),
  - `AgentUpdateResult` (agent -> server: update success/rollback/failure).

Core message fields:
- common envelope: `protocol_version`, `agent_id`, `session_id`, `command_id`, `job_id`, `timestamp`;
- command/event payload as typed oneof;
- error envelope: `code`, `message`, `retryable`, `details`.
- update signal payload fields:
  - `current_version`, `min_supported_version`, `target_version`, `update_required`, `reason`.
  - update execution payload fields:
    - `artifact_url`, `artifact_sha256`, `signature`, `signature_key_id`, `install_mode`, `rollback_supported`.

## 5.4 Proto format (baseline)

```proto
syntax = "proto3";
package julia.agent.v1;

service AgentControlService {
  rpc Connect(stream AgentEnvelope) returns (stream ServerEnvelope);
}

service AgentAuthService {
  rpc Enroll(EnrollRequest) returns (EnrollResponse);
  rpc Refresh(RefreshRequest) returns (RefreshResponse);
  rpc Revoke(RevokeRequest) returns (RevokeResponse);
}

message AgentEnvelope {
  string protocol_version = 1;
  string agent_id = 2;
  string session_id = 3;
  string command_id = 4;
  string job_id = 5;
  int64 timestamp_unix_ms = 6;
  string access_jwt = 7;
  oneof payload {
    AgentEvent event = 10;
    EventAck ack = 11;
    AgentUpdateSignal update_signal = 12;
    AgentUpdateReady update_ready = 13;
    AgentUpdateResult update_result = 14;
  }
}

message ServerEnvelope {
  string protocol_version = 1;
  string session_id = 2;
  string command_id = 3;
  int64 timestamp_unix_ms = 4;
  oneof payload {
    CommandDispatch command = 10;
    AgentUpdateInstruction update_instruction = 11;
    AgentUpdateAcknowledge update_ack = 12;
    ErrorEnvelope error = 13;
  }
}
```

## 6) Authentication & Trust

## 6.1 Identity model

- Agent identity starts from one-time **enrollment token**.
- On successful enrollment server issues:
  - `agent_id`,
  - long-lived `refresh_token`,
  - short-lived `access_jwt`.
- All operational calls require `access_jwt`; refresh endpoint rotates tokens.

## 6.2 JWT policy

Short-lived JWT (60-300 sec) for command/event authorization with claims:
- `iss`,
- `aud=agent-control`,
- `agent_id`,
- `scope`,
- `exp`,
- `jti`,
- optional `job_id`.

Validation is mandatory on each protected message.

Refresh token policy:
- stored hashed in DB (`agent_sessions` or dedicated table),
- stored hashed in `agent-auth.db` (`agent_refresh_tokens`),
- rotated on refresh,
- immediate revoke supported from server UI/API.

## 6.3 Replay protection

- keep `jti` cache with TTL >= token lifetime;
- reject duplicate `jti`;
- store security events in audit logs.

## 6.4 Infisical role

Infisical usage:
- store/rotate server secrets (JWT signing key refs, enrollment secrets, refresh token pepper);
- store agent bootstrap secrets if needed.

Infisical is **not** used as direct auth/identity provider.

## 6.5 Server API (JWT-first)

Public agent auth API (HTTP, JSON):
- `POST /api/agent/enroll`
  - request: `enrollment_token`, `device_info`, `agent_version`, `capabilities`.
  - response: `agent_id`, `access_jwt`, `refresh_token`, `expires_in`.
- `POST /api/agent/token/refresh`
  - request: `agent_id`, `refresh_token`.
  - response: rotated `access_jwt`, rotated `refresh_token`, `expires_in`.
- `POST /api/agent/token/revoke`
  - request: `agent_id`, `refresh_token` (or revoke-all flag).
  - response: `revoked: true`.

Agent control ingress (gRPC over HTTP/2):
- `POST /api/agent/grpc` (Traefik route to gRPC service; browser never calls it).

Operational API (server internal/admin):
- `GET /api/agent/status/:agentId`
- `POST /api/agent/update/:agentId/instruct`
- `POST /api/agent/update/:agentId/ack`

## 7) Rust Agent (Modular)

## 7.1 Agent runtime

- Windows service process;
- connector registry trait with capability discovery;
- command dispatcher with cancellation and retries;
- structured logs and heartbeat loop.
- version checker loop (local binary version vs server policy) with periodic update signaling.

## 7.2 v1 connectors

- `connector.health`
  - `ping`, `version`, `capabilities`.
- `connector.fs`
  - list/read within allowed roots only.
- `connector.transcribe`
  - validate selection;
  - merge/convert by `ffmpeg`;
  - run `gemini-cli`;
  - save `.txt`;
  - cleanup temp files on success/failure/cancel.

## 7.3 Safety constraints

- hard path allowlist (e.g. `C:\Users\julia\OneDrive`);
- no arbitrary command execution;
- cancellation must terminate child processes and cleanup temp artifacts.

## 7.4 Agent self-update flow

Goal:
- agent updates itself automatically when a new approved version is published.

Mandatory flow:
1. Agent sends `AgentUpdateSignal` with `current_version`.
2. Server compares with rollout policy (`target_version`, `min_supported_version`).
3. If update required, server sends `AgentUpdateInstruction`.
4. Agent downloads artifact from server-approved source.
5. Agent verifies checksum (`sha256`) and detached signature.
6. Agent performs staged install:
   - place new binary in versioned folder,
   - update service pointer/config,
   - restart service.
7. Agent reconnects and reports `AgentUpdateResult`.
8. On failed startup/health check, automatic rollback to previous binary.

Safety rules:
- no unsigned or hash-mismatched package can be installed;
- update is blocked if agent is running active transcribe job;
- rollout supports canary groups (`agent_id` allowlist);
- server can set maintenance mode if version < `min_supported_version`.

## 8) Migration Phases

Phase 0:
- create protocol package and initial proto schema;
- add Agent Control Core skeleton in server;
- add DB migrations for `agent-auth.db` and `core.db`.

Phase 1:
- implement enrollment + JWT session/auth manager;
- implement Rust agent runtime + `health` connector;
- verify heartbeat/session lifecycle;
- add update signaling (`AgentUpdateSignal`) and persistence in `agent_update_state`.

Phase 2:
- implement `fs` connector and widget bridge for fs-related actions;
- keep old local server paths as fallback.

Phase 3:
- implement `transcribe` connector end-to-end;
- route transcribe widget flow through agent jobs.

Phase 4:
- disable legacy local transcribe execution on server by default;
- keep explicit rollback flag.
- add server-side policy gate: agents below `min_supported_version` are marked degraded and can be blocked from new jobs.

Phase 5:
- enable autonomous self-update in production:
  - signed release artifacts,
  - canary rollout,
  - automatic rollback telemetry and alerting.

## 9) Testing Strategy

Contract:
- protobuf compatibility tests between TS and Rust generated code.

Security:
- enrollment token validation tests;
- invalid/expired JWT rejection;
- replay (`jti`) rejection.
- refresh rotation and revoked-token rejection.
- cross-DB consistency checks (`agent-auth.db` vs `core.db` mapping by `agent_id`).

Session:
- connect, heartbeat, reconnect, expiration, revocation.
- update notification lifecycle: signal received -> persisted -> published -> acknowledged.

Integration:
- transcribe job: command -> progress -> done/error -> widget SSE mapping.

Failure:
- agent offline during active job;
- duplicate event delivery;
- delayed ack and retry idempotency.
- stale agent version: new jobs denied when `update_required=true` and policy is strict.
- bad update artifact/signature mismatch: install denied and reported.
- service restart failure after update: rollback executed and reported.

## 10) Operational Rollback

Rollback switch:
- feature flag in server: `AGENT_TRANSCRIBE_ENABLED=false` (legacy local path active).

Emergency procedure:
- disable agent routing;
- keep widget endpoints and UI stable;
- restore local transcribe path without client changes.
