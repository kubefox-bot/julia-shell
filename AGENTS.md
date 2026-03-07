# AGENTS.md

Last updated: 2026-03-07

## Purpose
This is Yulia's Astro app. The project is edited from Mac when needed, but the real target environment is a Windows machine on the local network.

Primary goals:
- Gemini chat UI,
- `.m4a` transcription through Gemini API,
- Windows-friendly local utility dashboard,
- server control and personal widgets.

## Canonical Target Host
Primary deployment target:
- Host IP: `192.168.100.102`
- SSH user: `sshuser`
- OS: Windows
- Project path on target: `C:\Users\julia\OneDrive\ssr`
- Main browser URL: `http://julia.love:4321`
- Direct LAN URL: `http://192.168.100.102:4321`

Important:
- treat the Windows copy as the execution source of truth,
- treat this Mac copy as a working mirror / editing workspace,
- when syncing changes, upload into `C:\Users\julia\OneDrive\ssr`.

## Sync / Upload Notes
When copying this project to Windows, exclude:
- `node_modules`
- `.astro`
- `dist`
- `dev.stdout.log`
- `dev.stderr.log`

Safe approach:
- sync source files and config only,
- then run dependency/build commands on Windows itself.

## Package Manager
- package manager: `Yarn 4`
- linker: `node-modules`
- core command path on Windows usually resolves through `corepack.cmd`

Useful commands:
- `yarn install`
- `yarn dev`
- `yarn build`
- `yarn start`

## Runtime Model
Astro runs in server mode with `@astrojs/node` standalone.

Production entrypoint:
- `node ./dist/server/entry.mjs`

Testing mode currently used during active UI work:
- `yarn dev --host 0.0.0.0 --port 4321`

## Gemini Settings
Gemini settings are no longer stored in cookie.

Current storage model:
- file on disk: `data/gemini-settings.json`
- file contains:
  - `apiKey`
  - `model`

Frontend behavior:
- transcription card has a gear button,
- settings panel contains API key input,
- settings panel contains model selector,
- default model is `gemini-2.5-flash`.

Backend behavior:
- `src/pages/api/gemini-settings.ts` exposes settings load/save,
- `src/lib/gemini-settings.ts` is the helper/source of truth,
- `src/pages/api/transcribe-stream.ts` reads settings from file.

## Transcription Flow
Current flow:
- user browses folders,
- user manually selects an `.m4a` file,
- `ffmpeg` converts it to temporary `mono Opus`,
- prompt is loaded from `Transcript.md`,
- Gemini API receives uploaded audio,
- transcript returns over SSE,
- result view opens on first token,
- text is rendered with a typewriter-style progressive animation,
- action buttons stay locked while transcript is still being revealed,
- after completion buttons unlock.

Result actions:
- `Назад`
- `Прочитать`
- `Скопировать`
- `Сохранить`

`Прочитать` uses browser `speechSynthesis`.

Temporary converted audio must still be deleted after completion or failure.

## Current Models
Preferred order is built from settings, but practical defaults are:
- `gemini-2.5-flash`
- `gemini-2.0-flash`
- optional selectable `gemini-2.5-pro`

Do not assume `pro` is available on free tier.

## Main Files
Core UI:
- `src/pages/index.astro`

Gemini transcription:
- `src/pages/api/transcribe-stream.ts`
- `src/pages/api/transcribe-save.ts`
- `src/pages/api/gemini-settings.ts`
- `src/lib/gemini-settings.ts`
- `Transcript.md`

Browser/file helpers:
- `src/pages/api/fs-list.ts`

Other runtime helpers:
- `src/pages/api/server-status.ts`
- `src/pages/api/server-control.ts`
- `src/lib/server-control.ts`

Windows scripts:
- `scripts/windows/astro-prod-common.ps1`
- `scripts/windows/astro-prod-control.ps1`
- `scripts/windows/astro-prod-register-task.ps1`
- `scripts/windows/astro-prod-runner.ps1`

## Operational Notes
- after frontend or API changes, re-run `yarn build` on Windows before checking production,
- during active UI iteration, use `yarn dev` on Windows,
- if the page looks stale, suspect old browser cache or old `dist`,
- if styles do not update, force refresh with `Ctrl+F5`.

## Safety Rules
- do not commit or expose the real Gemini API key,
- do not sync `data/gemini-settings.json` to public places,
- keep the Windows path and port stable unless there is a deliberate migration,
- preserve cleanup of temporary audio files,
- preserve SSE event contract unless both frontend and backend are updated together.
