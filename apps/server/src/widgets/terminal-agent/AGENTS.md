# AGENTS.md (Terminal Agent Widget)

Last updated: 2026-03-09

## Scope
Widget identity:
- `widgetId`: `com.yulia.terminal-agent`
- `name`: `Terminal Agent`
- `version`: `1.0.0`

## Responsibilities
- chat-style interaction with runtime-agent;
- providers in v1: `codex`, `gemini`;
- streaming response and intermediate status events;
- persist provider settings and continuity refs in `terminal-agent.db`;
- resolve provider LLM model list through shared domain `llm-catalog`;
- follow shell day/night theme and shared design system.

## Public Widget Actions (`/api/widget/com.yulia.terminal-agent/*`)
- `GET settings`
- `POST settings`
- `GET dialog-state`
- `POST dialog/new`
- `GET models`
- `POST message-stream`

## SSE Contract (`message-stream`)
Events:
- `status`
- `assistant_chunk`
- `assistant_done`
- `resume_failed`
- `error`

## Invariants
- only `medium` and `large` widget sizes;
- command execution defaults to direct binary (`path + args`) without shell;
- shell fallback is optional and explicit in settings;
- provider switch resets continuity;
- on resume failure widget must surface error and require explicit new dialog.

## Mapping Layout (Passport-style separation)
- HTTP handler: `server/handlers.ts`
  - validates query/body via `zod`
  - invokes domain/repository services
  - returns transport-level JSON/SSE responses
- Mapping layer: `server/llm-models-mapping.ts`
  - maps domain `Result`/value into widget HTTP payload
  - maps domain error into HTTP status + error body
- Domain service: `src/domains/llm-catalog/server/service.ts`
  - remote provider fetch + retry + payload validation (`zod`)
  - fallback policy (remote -> DB)
- Repository: `src/core/db/llm-model-repository.ts`
  - typed DB read/write (`drizzle`)
  - typed `Result` (`neverthrow`) for persistence operations

## Storage Mapping
- DB file: `data/llm-catalog.db`
- Table: `llm_model_catalog`
- Key columns:
  - `consumer` (`terminal-agent`)
  - `provider` (`codex|gemini`)
  - `model_id` (provider model id)
- Freshness column:
  - `updated_at` (used for TTL/fresh-cache decision in domain service)
