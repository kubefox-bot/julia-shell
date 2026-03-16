# LLM Catalog Domain

Shared server domain that resolves provider model catalogs and persists them locally.

## Current consumers
- `com.yulia.terminal-agent`

## Current providers
- `codex` (OpenAI models API)
- `gemini` (Google Generative Language models API)

## Contract
- input: provider + apiKey + forceRefresh
- output: typed `Result` with:
  - provider
  - models list
  - source (`db|remote`)
  - stale flag
  - updatedAt

## Persistence
- SQLite DBs:
  - `llm-catalog.db` (`llm_model_catalog`)
  - `llm-runtime.db` (`llm_consumer_settings`, `llm_consumer_dialog_state`, `llm_consumer_dialog_refs`)

## Design principles
- `zod` for external payload validation
- `oxide.ts` for explicit error flow
- `drizzle` for typed DB access
