# JuliaApp

Локальный Astro-проект для Юли. Основной хост выполнения и использования проекта: Windows-машина `192.168.100.102`.

## Назначение
- чат с Gemini,
- транскрибация `.m4a` через Gemini API,
- выбор папок и файлов,
- сохранение стенограммы в `.txt`,
- персональные карточки: погода, Telegram, статус сервера.

## Основной Windows target
- Host: `192.168.100.102`
- User: `sshuser`
- Project path: `C:\Users\julia\OneDrive\ssr`
- Local URL on Windows: [http://julia.love:4321](http://julia.love:4321)
- LAN URL: [http://192.168.100.102:4321](http://192.168.100.102:4321)

Этот репозиторий на Mac считается рабочей копией. Финальный запуск и проверка происходят на Windows.

## Разработка
Проект использует `Yarn 4`.

```bash
yarn install
yarn dev
yarn build
```

## Транскрибация
Текущая схема:
- выбирается `.m4a` файл,
- `ffmpeg` сжимает его во временный `mono Opus`,
- backend отправляет аудио в Gemini API,
- prompt берётся из `Transcript.md`,
- ответ идёт по SSE,
- текст печатается постепенно в финальном окне,
- готовую стенограмму можно прочитать, скопировать и сохранить.

## Где хранятся Gemini settings
Теперь ключ и выбранная модель хранятся на сервере, а не в cookie.

Файл настроек на проекте:
- `data/gemini-settings.json`

UI:
- шестерёнка в карточке транскрибации,
- поле для `Gemini API Key`,
- выбор модели,
- по умолчанию `gemini-2.5-flash`.

## Заливка на Windows
Если работа идёт из этой Mac-копии, заливать нужно в:
- `sshuser@192.168.100.102:C:/Users/julia/OneDrive/ssr`

При ручной синхронизации не нужно переносить:
- `node_modules`
- `.astro`
- `dist`
- временные логи `dev.stdout.log`, `dev.stderr.log`

После заливки на Windows:
```bash
yarn build
```
или для проверки в dev:
```bash
yarn dev --host 0.0.0.0 --port 4321
```

## Ключевые файлы
- `src/pages/index.astro`
- `src/pages/api/transcribe-stream.ts`
- `src/pages/api/transcribe-save.ts`
- `src/pages/api/fs-list.ts`
- `src/pages/api/gemini-settings.ts`
- `src/lib/gemini-settings.ts`
- `Transcript.md`
