# JuliaApp (Shell v1.2)

Локальный Astro-проект для Юли. Основной target-хост: Windows `192.168.100.102`.

## Что сейчас внутри
- `Astro host + React shell UI`
- только 2 виджета:
  - `com.yulia.transcribe`
  - `com.yulia.weather`
- extension-like widget registry (`manifest + handlers`)
- единый namespace API: `/api/widget/:id/*`
- shell settings (layout columns + modules table)
- drag/edit/save/cancel для widget grid
- channels:
  - internal bus
  - webhook (`/api/channel/webhook/:id/:event`)
  - ws endpoint (`/api/channel/ws`, SSE fallback transport)

## SQLite
Используются отдельные БД в `data/`:
- `passport.db` — agent/passport registry, sessions, tokens, enrollment
- `core.db` — shell layout/settings/module state
- `weather.db` — cache погоды
- `transcribe.db` — jobs/outbox транскрибации

## API
- `GET /api/shell/settings`
- `POST /api/shell/settings/layout`
- `GET /api/shell/modules`
- `POST /api/shell/modules/:id/enable`
- `POST /api/shell/modules/:id/disable`
- `GET|POST /api/passport/agent/*`
- `GET|POST /api/widget/:id/*`
- `POST /api/channel/webhook/:id/:event`
- `GET|POST /api/channel/ws` (SSE fallback transport для channel stream)

## Environment
Нужны переменные:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (опционально, default: `gemini-2.5-flash`)
- `ADMIN_TOKEN`
- `AGENT_JWT_SECRET`
- `JULIAAPP_SHELL_STATUS_POLL_INTERVAL_MS` (опционально, default: `1500`)
- для Infisical service account:
  - `INFISICAL_CLIENT_ID`
  - `INFISICAL_CLIENT_SECRET`
  - `INFISICAL_PROJECT_ID`
  - `INFISICAL_SITE_URL` (опционально, default SaaS URL)
- пример: `.env.example`

Для быстрой dev-настройки Infisical используй локальный файл `.env.infisical.local`.
Он читается core secret layer автоматически на старте и не коммитится в git.
Шаблон: `.env.infisical.example`

## Команды
```bash
yarn install
yarn dev
yarn test
yarn build
yarn start
```

`yarn build` теперь делает production-минификацию (Terser) и дополнительно генерирует precompressed ассеты (`.gz` и `.br`) для `dist/client`.
Если нужен только чистый build без этапа сжатия, используй `yarn build:raw`.

## Podman scaffold
Добавлены базовые файлы:
- `Containerfile`
- `podman-compose.yml`

Это scaffold-уровень, не production-ready runtime-контур.

## Agent Architecture Plan
- migration plan for dedicated server + Rust agent:
  - `docs/agent-architecture-plan.md`

## Windows target
- Host: `192.168.100.102`
- User: `sshuser`
- Project path: `C:\Users\julia\OneDrive\ssr`
- URL: `http://julia.love:4321`

Mac-репозиторий считается рабочим зеркалом, финальная проверка — на Windows.
