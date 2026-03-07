# AGENTS.md (Transcribe Widget)

Last updated: 2026-03-08

## Scope
This file describes the transcribe widget mini-project.

Widget identity:
- `widgetId`: `com.yulia.transcribe`
- `name`: `Transcribe`
- `version`: `1.0.0`

## Responsibilities
- browse filesystem folders,
- select one or multiple `.m4a` or `.opus` files,
- preserve user selection order for multi-file transcription,
- merge selected files into one temporary source before Gemini upload,
- compress merged audio to low-bitrate mono `.opus` for minimal payload size,
- run transcription through Gemini,
- expose a dev-only `mock` model for local flow testing,
- stream transcript via SSE events,
- save transcript `.txt` next to source audio,
- persist jobs, outbox, settings, and recent folders in `transcribe.db`,
- read locale from shell core props and render widget-local i18n strings.

## Source of Truth Files
Server:
- `src/widgets/transcribe/server/module.ts`

UI:
- `src/widgets/transcribe/ui/TranscribeWidget.tsx`
- `src/widgets/transcribe/ui/TranscribeWidget.module.scss`
- `src/widgets/transcribe/i18n/index.ts`
- `src/widgets/transcribe/i18n/ru.ts`
- `src/widgets/transcribe/i18n/en.ts`

## Public Widget Actions (`/api/widget/com.yulia.transcribe/*`)
- `POST fs-list`
- `POST transcript-read`
- `GET jobs`
- `GET settings`
- `POST settings`
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
- `transcribe_jobs`: current job lifecycle (`queued`, `processing`, `completed`, `failed`),
  progress, model, platform, source/save paths, error text, timestamps.
- `transcribe_outbox`: append-only event log for selection, processing, file creation, read, and failure states.
- `transcribe_widget_settings`: persisted Gemini model and local API key fallback for this widget.
- `transcribe_recent_folders`: top folders used by the widget select control.

## Invariants
- only `.m4a` and `.opus` input is accepted,
- selected files must belong to one folder,
- selected files are processed in the exact order chosen by the user,
- multiple selected inputs are merged by `ffmpeg` into one temporary stream before upload,
- upload source is always a temporary low-quality mono Opus file,
- temporary merged/converted files must be deleted in all outcomes,
- empty Gemini transcript is an error,
- locale comes only from shell core `WidgetRenderProps.locale`,
- host platform comes from shell core `WidgetRenderProps.platform`,
- API key resolution order is:
  - Infisical path `/<manifest.envName>` when available,
  - widget DB fallback,
  - env fallback,
- for this widget `manifest.envName` is `transcribe`.

## External Dependencies
- `ffmpeg` binary in `tools/ffmpeg`
- prompt file: `Transcript.md`
- Gemini SDK: `@google/genai`
- Infisical SDK: `@infisical/sdk`
- local dev Infisical env file: `.env.infisical.local` (template: `.env.infisical.example`)

## UX Notes
- result opens with typewriter rendering,
- action buttons remain locked while typewriter queue is active,
- result view speech playback uses browser `speechSynthesis`,
- top folders are loaded from `transcribe.db`, not browser localStorage,
- `Транскрибация` button is shown only when supported audio is selected,
- there is no setup-stage `.txt` open button in the widget UI,
- settings icon opens widget-local Gemini/API key settings.
- on desktop, this widget must fit shell fixed card height `435px`;
- if content exceeds card height, internal areas should scroll instead of growing outer card.

## Processing Pipeline
1. User opens a folder and selects one or more `.m4a` / `.opus` files.
2. Server validates that all selected files belong to the same folder.
3. `ffmpeg` merges selected files in selection order into one temporary source.
4. The merged source is converted to a compact mono Opus file with low bitrate.
5. Gemini receives that single Opus payload and returns streamed transcript tokens.
6. Final `.txt` is saved next to the source files.

## Safe Change Checklist
Before finishing changes:
- run `yarn test`
- run `yarn build`
- manually verify one real or `mock` transcription flow
- confirm temp files cleanup still works
- confirm `.txt` save path and status messages are correct
