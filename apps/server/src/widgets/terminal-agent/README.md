# Terminal Agent Widget

Chat widget for `Codex` and `Gemini CLI` over Julia runtime-agent transport.

## Endpoints
- `GET /api/widget/com.yulia.terminal-agent/settings`
- `POST /api/widget/com.yulia.terminal-agent/settings`
- `GET /api/widget/com.yulia.terminal-agent/dialog-state`
- `POST /api/widget/com.yulia.terminal-agent/dialog/new`
- `GET /api/widget/com.yulia.terminal-agent/models`
- `POST /api/widget/com.yulia.terminal-agent/message-stream`

## Persistence
- `terminal-agent.db`
  - provider settings (api keys, commands, args, shell fallback)
  - continuity references (`provider_session_ref`) per provider
- `llm-catalog.db`
  - provider LLM model catalog (`llm_model_catalog`) resolved by domain service

## UI
- Chat bubble UX, not terminal emulator
- Day/night support
- Uses shared design-system primitives (`Button`, `OptionSelect`)

## Layering
- `handlers.ts`: transport + validation
- `llm-models-mapping.ts`: HTTP mapping for `GET models`
- `domains/llm-catalog/server/service.ts`: provider fetch/retry/fallback
- `core/db/llm-model-repository.ts`: drizzle + neverthrow persistence
