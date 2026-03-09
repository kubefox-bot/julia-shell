# Julia Agent (Rust)

Rust runtime for JuliaApp passport flow.

## Auth Namespace

Agent uses only:

- `POST /api/passport/agent/enroll`
- `POST /api/passport/agent/token/refresh`

## First Enroll

1. Admin creates token:
   - `POST /api/passport/agent/enroll-token/create`
2. Response returns:
   - `agent_id`
   - `enrollment_token`
3. Put both into `.env`:
   - `JULIA_AGENT_ID`
   - `JULIA_AGENT_ENROLLMENT_TOKEN`

## Session File

`session.json` stores:

- `agent_id`
- `refresh_token`
- `access_jwt`
- `access_token_expires_at` (if known)

Default path:

- macOS/Linux: `~/.julia-agent/session.json`
- Windows: `%USERPROFILE%\\.julia-agent\\session.json`

Override with `JULIA_AGENT_REFRESH_TOKEN_PATH`.
