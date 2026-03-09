# Passport Domain AGENTS

## Domain Rules

- Keep all passport-related logic cohesive under `domains/passport/`:
  - `server/` for JWT/cookie/context/repository/runtime helpers.
  - `client/` for Zustand slice + API calls.
  - `ui/` for online/offline status components.
- Do not reintroduce `/api/agent/*`; use only `/api/passport/agent/*`.
- Source of `agent_id` for shell/widget/channel is JWT `sub`.

## UI Rules

- Passport UI must follow existing shell design codes.
- Reuse shared UI primitives from `src/shared/ui`.
- Do not introduce a parallel design system for passport components.

## Security Model (MVP)

- Single `access_jwt` is shared between agent and browser cookie flow.
- JWT sign/verify uses `AGENT_JWT_SECRET`.
- `WIDGET_CHANNEL_TOKEN` and `X-Widget-Token` are not used.

## Data Rules

- `passport.db` is canonical auth/session DB.
- `core.db` and `transcribe.db` are per-agent (`agent_id` scoped).
- Legacy global rows are reset on schema bootstrap (no soft migration).

