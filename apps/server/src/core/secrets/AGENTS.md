# AGENTS.md (Core Secrets)

Last updated: 2026-03-07

## Scope
This file describes the `src/core/secrets` mini-module.

Module purpose:
- load Infisical config from `.env.infisical.local`,
- expose one small wrapper for secret access,
- keep server-side secret reads simple and predictable.

## Public API
Entry:
- `src/core/secrets/secrets.ts`

Client:
- `src/core/secrets/InfisicalSecrets.ts`

Methods:
- `secrets.init()`
- `secrets.get(keyName, path?)`

`get(keyName, path?)` behavior:
- if Infisical config exists and `path` is provided, try Infisical first,
- if Infisical did not return a value, fall back to `process.env[keyName]`,
- return `null` when nothing is found.

Infisical auth priority:
1. `JULIAAPP_INFISICAL_ACCESS_TOKEN`
2. `JULIAAPP_INFISICAL_CLIENT_ID` + `JULIAAPP_INFISICAL_CLIENT_SECRET`
3. otherwise Infisical provider is unavailable

## Source of Truth Files
- `src/core/secrets/secrets.ts`
- `src/core/secrets/InfisicalSecrets.ts`
- `src/core/secrets/types.ts`
- `src/core/secrets/utils/initSecrets.ts`
- `src/core/secrets/utils/getInfisicalConfig.ts`
- `src/core/secrets/utils/normalizeSecretPath.ts`

## Invariants
- `.env.infisical.local` is the only file this module initializes explicitly,
- initialization must be idempotent,
- secret path must be normalized to leading-slash form,
- `get()` must stay simple:
  - first argument is secret key,
  - second argument is optional Infisical path,
- no provider chain,
- no multi-step diagnostic contract,
- no barrel files in this folder.

## Runtime Env
Required for Infisical mode:
- `JULIAAPP_INFISICAL_PROJECT_ID`

Optional:
- `JULIAAPP_INFISICAL_ACCESS_TOKEN`
- `JULIAAPP_INFISICAL_CLIENT_ID`
- `JULIAAPP_INFISICAL_CLIENT_SECRET`
- `JULIAAPP_INFISICAL_SITE_URL`
- `JULIAAPP_INFISICAL_ENVIRONMENT`

## Safe Change Checklist
Before finishing changes:
- run `yarn biome check biome.json src/core/secrets`
- run `yarn vitest run tests/secrets.test.ts tests/channel-auth.test.ts`
- run `yarn astro check`
- verify `secrets.get('GEMINI_API_KEY', 'transcribe')` still resolves correctly
