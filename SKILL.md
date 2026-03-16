# Localhost Check/Run Skill

## Trigger
Use this flow when the user says words like:
- `проверка`
- `запуск`
- `локахост` / `localhost`

## Required order
Always execute in this order:
1. Start local server from repo root.
2. Create enrollment token (admin-auth API).
3. Update `apps/agent/.env` with new `JULIA_AGENT_ID` and `JULIA_AGENT_ENROLLMENT_TOKEN`.
4. Start agent from repository folder `apps/agent`.
5. Verify server and agent connectivity.

## Fixed admin token
Use this admin token for local enroll API:

`yT3PiC*kCg8hz04t!EGj9oqcAwfnW8C7qrNgLQgx9kJW-.yTh1k5EaSNUEYwK2kP`

## Commands

### 1) Start server
From repo root:

```bash
yarn dev
```

Expected: server on `http://localhost:4321`.

### 2) Create enroll token
In another terminal:

```bash
curl -sS -X POST "http://127.0.0.1:4321/api/passport/agent/enroll-token/create" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: yT3PiC*kCg8hz04t!EGj9oqcAwfnW8C7qrNgLQgx9kJW-.yTh1k5EaSNUEYwK2kP" \
  -d '{"label":"DEV-local","uses":1,"ttl_minutes":120}'
```

Take values from response:
- `agent_id`
- `enrollment_token`

### 3) Update agent env
Edit:

`apps/agent/.env`

Set:
- `JULIA_AGENT_SERVER_URL=http://127.0.0.1:4321`
- `JULIA_AGENT_GRPC_ENDPOINT=http://127.0.0.1:50051`
- `JULIA_AGENT_ID=<agent_id from step 2>`
- `JULIA_AGENT_ENROLLMENT_TOKEN=<enrollment_token from step 2>`

### 4) Start agent from repo folder
From:

`apps/agent`

Run:

```bash
./start-agent.sh
```

### 5) Verify
Check online agent list:

```bash
curl -sS "http://127.0.0.1:4321/api/passport/agent/status/list"
```

Expected: non-empty `agents` array.

## Browser auth note
`/api/passport/agent/status` without browser cookie can still show:

`"reason":"No browser access token."`

This is normal. In UI, select agent to set `julia_access_token` cookie via `/api/passport/agent/status/connect`.
