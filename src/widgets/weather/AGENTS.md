# AGENTS.md (Weather Widget)

Last updated: 2026-03-07

## Scope
This file describes the weather widget mini-project.

Widget identity:
- `widgetId`: `com.yulia.weather`
- `name`: `Weather`
- `version`: `1.0.0`

## Responsibilities
- provide Batumi weather forecast in shell UI,
- read through server API with cache,
- allow manual refresh,
- return cached data when upstream is unavailable.

## Source of Truth Files
Server:
- `src/widgets/weather/server/plugin.ts`

UI:
- `src/widgets/weather/ui/WeatherWidget.tsx`
- `src/widgets/weather/ui/WeatherWidget.module.scss`

## Public Widget Actions (`/api/widget/com.yulia.weather/*`)
- `GET forecast`
- `POST refresh`

## Data / Persistence
DB:
- `data/weather.db`

Cache policy:
- location fixed to Batumi,
- TTL is 30 minutes,
- cache fallback allowed if Open-Meteo call fails.

## Invariants
- keep Batumi coordinates stable unless a deliberate feature change is requested,
- keep response shape stable for UI (`summary`, `mood`, `days`, `fetchedAt`, `fromCache`),
- do not add secret/API key dependency for weather in current model.

## External Dependencies
- weather provider: Open-Meteo

## UX Notes
- show summary and mood text,
- show list of upcoming days,
- show refresh button,
- show update time and cache indicator.

## Safe Change Checklist
Before finishing changes:
- run `yarn test`
- run `yarn build`
- manually verify `forecast` and `refresh` endpoints
- verify cache behavior (fresh + stale fallback)
