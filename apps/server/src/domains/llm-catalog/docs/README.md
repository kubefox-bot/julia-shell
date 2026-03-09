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
- SQLite DB: `llm-catalog.db`
- Table: `llm_model_catalog`

## Design principles
- `zod` for external payload validation
- `neverthrow` for explicit error flow
- `drizzle` for typed DB access
