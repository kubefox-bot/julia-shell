# Terminal Agent Widget

Chat widget for `Codex` and `Gemini CLI` over Julia runtime-agent transport.

## Endpoints
- `GET /api/widget/com.yulia.terminal-agent/settings`
- `POST /api/widget/com.yulia.terminal-agent/settings`
- `GET /api/widget/com.yulia.terminal-agent/dialog-state`
- `POST /api/widget/com.yulia.terminal-agent/dialog/new`
- `POST /api/widget/com.yulia.terminal-agent/message-stream`

## Persistence
- `terminal-agent.db`
  - provider settings (api keys, commands, args, shell fallback)
  - continuity references (`provider_session_ref`) per provider

## UI
- Chat bubble UX, not terminal emulator
- Day/night support
- Uses shared design-system primitives (`Button`, `OptionSelect`)
