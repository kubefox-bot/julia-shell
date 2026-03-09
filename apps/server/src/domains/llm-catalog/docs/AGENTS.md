# AGENTS.md (LLM Catalog Domain)

Last updated: 2026-03-09

## Scope
Domain identity:
- `domain`: `llm-catalog`
- consumers now: `terminal-agent`
- providers now: `codex`, `gemini`

## Responsibilities
- unify LLM model resolution for provider-backed widgets;
- fetch model catalogs from remote provider APIs;
- validate remote payload shape (`zod`);
- persist and read catalog in local DB (`drizzle`);
- return typed `Result` (`neverthrow`) without throwing domain errors.

## Public Server API (used by widgets)
- consumed by terminal-agent `GET models` handler
- current service entrypoint:
  - `getLlmModelCatalog({ provider, apiKey, forceRefresh })`

## Storage Mapping
- DB file: `data/llm-catalog.db`
- table: `llm_model_catalog`
- columns:
  - `consumer`
  - `provider`
  - `model_id`
  - `updated_at`
- primary key:
  - `(consumer, provider, model_id)`

## Mapping Layout
- domain service:
  - `src/domains/llm-catalog/server/service.ts`
  - remote fetch/retry/fallback policy
- persistence:
  - `src/core/db/llm-model-repository.ts`
  - drizzle queries + neverthrow Result
- DB schema/bootstrap:
  - `src/core/db/llm-catalog-schema.ts`
  - `src/core/db/llm-catalog-drizzle.ts`
- widget transport mapping:
  - `src/widgets/terminal-agent/server/llm-models-mapping.ts`

## Error Model
- domain returns `Result<T, LlmCatalogError>`
- error codes:
  - `db_error`
  - `provider_http_error`
  - `provider_request_failed`
  - `provider_payload_invalid`
