# AGENTS.md (Transcribe UI)

Last updated: 2026-03-08

## Scope
This file documents the transcribe widget frontend layer.

Main entry:
- `src/widgets/transcribe/ui/TranscribeWidget.tsx`

## Current UI Architecture
- `TranscribeWidget.tsx` is a thin shell.
- orchestration and async UI flow live in:
  - `src/widgets/transcribe/ui/hooks/useTranscribeController.ts`
- widget state is managed by Zustand slices:
  - `browser`
  - `session`
  - `result`
  - `settings`

## Main Components
- `components/SetupView.tsx`
- `components/ResultView.tsx`
- `components/SettingsModal.tsx`
- `components/PathActionsRow.tsx`
- `components/PathCombobox.tsx`
- `components/BrowserList.tsx`
- `components/SelectionSummary.tsx`
- `components/SetupActions.tsx`
- `components/LoaderStrip.tsx`
- `components/ActionButton.tsx`
- `components/TranscribeIcons.tsx`

## Shared UI Used By Transcribe
- `src/shared/ui/IconCircle.tsx`
- `src/shared/ui/OptionSelect.tsx`
- `src/shared/ui/OptionMenu.tsx`

These shared components are already styled for day/night shell themes and should be reused instead of cloning local variants.

## Current UX Rules
- setup mode lets the user browse a folder and multi-select `.m4a` / `.opus` files,
- selection order matters and is shown in the browser list,
- path history is DB-backed and behaves like a stack with max 5 items,
- path history dropdown uses shared design-system options,
- settings model dropdown uses the same shared option pattern,
- `Транскрибация` is available only when supported audio is selected,
- `Прочитать` is available when the current folder contains a matching `.txt` for the selected or inferred primary audio file,
- opening `.txt` reuses the same result view and skips typewriter animation,
- transcription save is automatic on the server,
- after transcription completes, the folder is refreshed automatically,
- `Назад` clears loader/progress UI and returns to setup mode,
- there is no `Озвучить` button,
- there is no manual `Сохранить` button in the result view.

## Loader Rules
- only one visible transcription loader should exist,
- the loader must be full-width inside the widget,
- it must show percent and current stage,
- it is only for transcription, not for plain folder reads or `.txt` open.

## Styling Rules
- desktop shell card height is fixed, so internal areas must scroll instead of expanding the card,
- transcribe action buttons should use the same hover language as icon circles:
  lighter hover background, slight lift, soft shadow,
- option lists should come from shared `OptionMenu`,
- selected option state has higher priority than hover state,
- focus ring should keep the teal highlight currently used in the project,
- icon sizes are normalized to `21x21` in transcribe.

## Safe Change Checklist
- run `yarn test`
- run `yarn build`
- verify setup/result/settings views still fit fixed widget height
- verify history dropdown still closes after selection
- verify `Прочитать` still opens `.txt` instantly without animation
