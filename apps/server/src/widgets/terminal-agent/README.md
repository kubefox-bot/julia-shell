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
- `llm-catalog.db`
  - provider LLM model catalog (`llm_model_catalog`) resolved by domain service
- `llm-runtime.db`
  - consumer-based settings/dialog continuity (`llm_consumer_*` tables, consumer=`com.yulia.terminal-agent`)

## UI
- Chat bubble UX, not terminal emulator
- Day/night support
- Uses shared design-system primitives (`Button`, `OptionSelect`)

## Layering
- `handlers.ts`: transport + validation
- `llm-models-mapping.ts`: HTTP mapping for `GET models`
- `domains/llm/server/service.ts`: provider fetch/retry/fallback
- `domains/llm/server/repository/catalog-repository.ts`: drizzle + oxide.ts persistence
- `domains/llm/server/repository/runtime-repository.ts`: consumer-based settings/dialog state
