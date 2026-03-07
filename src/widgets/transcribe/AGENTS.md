# AGENTS.md (Transcribe Widget)

Last updated: 2026-03-07

## Scope
This file describes the transcribe widget mini-project.

Widget identity:
- `widgetId`: `com.yulia.transcribe`
- `name`: `Transcribe`
- `version`: `1.0.0`

## Responsibilities
- browse filesystem folders,
- select one or multiple `.m4a` files,
- run transcription through Gemini,
- stream transcript via SSE events,
- save transcript `.txt` next to source audio,
- persist outbox/job states in `transcribe.db`.

## Source of Truth Files
Server:
- `src/widgets/transcribe/server/plugin.ts`

UI:
- `src/widgets/transcribe/ui/TranscribeWidget.tsx`
- `src/widgets/transcribe/ui/TranscribeWidget.module.scss`

## Public Widget Actions (`/api/widget/com.yulia.transcribe/*`)
- `POST fs-list`
- `POST transcript-read`
- `GET jobs`
- `POST transcribe-stream`

## SSE Contract (`transcribe-stream`)
Events:
- `progress` (`percent`, `stage`, optional `jobId`)
- `token` (`text`, optional `model`, optional `jobId`)
- `done` (`transcript`, `savePath`, `sourceFile`, optional `jobId`)
- `error` (`message`, optional `jobId`)

Do not break this contract without synchronized frontend/backend update.

## Data / Persistence
DB:
- `data/transcribe.db`

Table role:
- `transcribe_jobs`: job lifecycle (`queued`, `processing`, `completed`, `failed`),
  progress, paths, error text, timestamps.

## Invariants
- only `.m4a` input is accepted,
- selected files must belong to one folder,
- temporary merged/converted files must be deleted in all outcomes,
- empty Gemini transcript is an error,
- API key is read from env secret provider (`GEMINI_API_KEY`), never from UI/db.

## External Dependencies
- `ffmpeg` binary in `tools/ffmpeg`
- prompt file: `Transcript.md`
- Gemini SDK: `@google/genai`

## UX Notes
- result opens with typewriter rendering,
- action buttons remain locked while typewriter queue is active,
- `Прочитать` uses browser `speechSynthesis`,
- local path and selected files are restored from browser localStorage.
- on desktop, this widget must fit shell fixed card height `435px`;
- if content exceeds card height, internal areas should scroll instead of growing outer card.

## Safe Change Checklist
Before finishing changes:
- run `yarn test`
- run `yarn build`
- manually verify one real transcription flow
- confirm temp files cleanup still works
- confirm `.txt` save path and status messages are correct
