# AGENTS.md (Terminal Agent Widget)

Last updated: 2026-03-09

## Scope
Widget identity:
- `widgetId`: `com.yulia.terminal-agent`
- `name`: `Terminal Agent`
- `version`: `1.0.0`

## Responsibilities
- chat-style interaction with runtime-agent;
- providers in v1: `codex`, `gemini`;
- streaming response and intermediate status events;
- persist provider settings and continuity refs in `terminal-agent.db`;
- follow shell day/night theme and shared design system.

## Public Widget Actions (`/api/widget/com.yulia.terminal-agent/*`)
- `GET settings`
- `POST settings`
- `GET dialog-state`
- `POST dialog/new`
- `POST message-stream`

## SSE Contract (`message-stream`)
Events:
- `status`
- `assistant_chunk`
- `assistant_done`
- `resume_failed`
- `error`

## Invariants
- only `medium` and `large` widget sizes;
- command execution defaults to direct binary (`path + args`) without shell;
- shell fallback is optional and explicit in settings;
- provider switch resets continuity;
- on resume failure widget must surface error and require explicit new dialog.
