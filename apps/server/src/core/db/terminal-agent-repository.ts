import { nowIso } from '@shared/lib/time'
import { openDb } from './shared'

export type TerminalAgentProvider = 'codex' | 'gemini'

export type TerminalAgentSettings = {
  agentId: string
  widgetId: string
  activeProvider: TerminalAgentProvider
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride: string
  updatedAt: string | null
}

export type TerminalAgentDialogState = {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  status: string
  lastError: string | null
  updatedAt: string | null
}

export type TerminalAgentDialogRef = {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  createdAt: string
  updatedAt: string
  lastStatus: string
}

const DEFAULT_CODEX_COMMAND = 'codex'
const DEFAULT_GEMINI_COMMAND = 'gemini'
const DEFAULT_CODEX_ARGS: string[] = []
const DEFAULT_GEMINI_ARGS = ['--output-format', 'stream-json']
const DEFAULT_CODEX_MODEL = 'gpt-5-codex'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toProvider(value: unknown, fallback: TerminalAgentProvider = 'codex'): TerminalAgentProvider {
  return value === 'gemini' ? 'gemini' : value === 'codex' ? 'codex' : fallback
}

function toArgs(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const args = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)

  return args.length > 0 ? args : fallback
}

function parseArgsJson(raw: string | null | undefined, fallback: string[]) {
  if (!raw) {
    return fallback
  }

  try {
    return toArgs(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

function bootstrap() {
  const db = openDb('terminal-agent.db')
  db.exec(`
    CREATE TABLE IF NOT EXISTS terminal_agent_settings (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      active_provider TEXT NOT NULL DEFAULT 'codex',
      codex_api_key TEXT,
      gemini_api_key TEXT,
      codex_command TEXT NOT NULL,
      codex_args_json TEXT NOT NULL,
      codex_model TEXT NOT NULL DEFAULT 'gpt-5-codex',
      gemini_command TEXT NOT NULL,
      gemini_args_json TEXT NOT NULL,
      gemini_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
      use_shell_fallback INTEGER NOT NULL DEFAULT 0,
      shell_override TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id)
    );

    CREATE TABLE IF NOT EXISTS terminal_agent_dialog_state (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_ref TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      last_error TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id, provider)
    );

    CREATE TABLE IF NOT EXISTS terminal_agent_dialog_refs (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_status TEXT NOT NULL DEFAULT 'done',
      PRIMARY KEY (agent_id, widget_id, provider, provider_session_ref)
    );

    CREATE INDEX IF NOT EXISTS idx_terminal_agent_dialog_state_updated
      ON terminal_agent_dialog_state(agent_id, widget_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_terminal_agent_dialog_refs_updated
      ON terminal_agent_dialog_refs(agent_id, widget_id, provider, updated_at DESC);
  `)

  const hasColumn = (table: string, column: string) => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    return rows.some((row) => row.name === column)
  }

  if (!hasColumn('terminal_agent_settings', 'codex_model')) {
    db.exec(`ALTER TABLE terminal_agent_settings ADD COLUMN codex_model TEXT NOT NULL DEFAULT 'gpt-5-codex'`)
  }
  if (!hasColumn('terminal_agent_settings', 'gemini_model')) {
    db.exec(`ALTER TABLE terminal_agent_settings ADD COLUMN gemini_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash'`)
  }

  return db
}

function getDb() {
  return bootstrap()
}

export function getTerminalAgentSettings(agentId: string, widgetId: string): TerminalAgentSettings {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      agent_id as agentId,
      widget_id as widgetId,
      active_provider as activeProvider,
      codex_api_key as codexApiKey,
      gemini_api_key as geminiApiKey,
      codex_command as codexCommand,
      codex_args_json as codexArgsJson,
      codex_model as codexModel,
      gemini_command as geminiCommand,
      gemini_args_json as geminiArgsJson,
      gemini_model as geminiModel,
      use_shell_fallback as useShellFallback,
      shell_override as shellOverride,
      updated_at as updatedAt
    FROM terminal_agent_settings
    WHERE agent_id = ? AND widget_id = ?
  `).get(agentId, widgetId) as {
    agentId: string
    widgetId: string
    activeProvider: string
    codexApiKey: string | null
    geminiApiKey: string | null
    codexCommand: string
    codexArgsJson: string
    codexModel: string | null
    geminiCommand: string
    geminiArgsJson: string
    geminiModel: string | null
    useShellFallback: number
    shellOverride: string | null
    updatedAt: string
  } | undefined

  return {
    agentId,
    widgetId,
    activeProvider: toProvider(row?.activeProvider, 'codex'),
    codexApiKey: toTrimmedString(row?.codexApiKey),
    geminiApiKey: toTrimmedString(row?.geminiApiKey),
    codexCommand: toTrimmedString(row?.codexCommand) || DEFAULT_CODEX_COMMAND,
    codexArgs: parseArgsJson(row?.codexArgsJson, DEFAULT_CODEX_ARGS),
    codexModel: toTrimmedString(row?.codexModel) || DEFAULT_CODEX_MODEL,
    geminiCommand: toTrimmedString(row?.geminiCommand) || DEFAULT_GEMINI_COMMAND,
    geminiArgs: parseArgsJson(row?.geminiArgsJson, DEFAULT_GEMINI_ARGS),
    geminiModel: toTrimmedString(row?.geminiModel) || DEFAULT_GEMINI_MODEL,
    useShellFallback: Boolean(row?.useShellFallback),
    shellOverride: toTrimmedString(row?.shellOverride),
    updatedAt: row?.updatedAt ?? null,
  }
}

export function saveTerminalAgentSettings(input: {
  agentId: string
  widgetId: string
  activeProvider: TerminalAgentProvider
  codexApiKey: string
  geminiApiKey: string
  codexCommand: string
  codexArgs: string[]
  codexModel: string
  geminiCommand: string
  geminiArgs: string[]
  geminiModel: string
  useShellFallback: boolean
  shellOverride?: string
}) {
  const db = getDb()
  const now = nowIso()
  const current = getTerminalAgentSettings(input.agentId, input.widgetId)

  db.prepare(`
    INSERT INTO terminal_agent_settings (
      agent_id,
      widget_id,
      active_provider,
      codex_api_key,
      gemini_api_key,
      codex_command,
      codex_args_json,
      codex_model,
      gemini_command,
      gemini_args_json,
      gemini_model,
      use_shell_fallback,
      shell_override,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, widget_id) DO UPDATE SET
      active_provider = excluded.active_provider,
      codex_api_key = excluded.codex_api_key,
      gemini_api_key = excluded.gemini_api_key,
      codex_command = excluded.codex_command,
      codex_args_json = excluded.codex_args_json,
      codex_model = excluded.codex_model,
      gemini_command = excluded.gemini_command,
      gemini_args_json = excluded.gemini_args_json,
      gemini_model = excluded.gemini_model,
      use_shell_fallback = excluded.use_shell_fallback,
      shell_override = excluded.shell_override,
      updated_at = excluded.updated_at
  `).run(
    input.agentId,
    input.widgetId,
    toProvider(input.activeProvider, current.activeProvider),
    toTrimmedString(input.codexApiKey),
    toTrimmedString(input.geminiApiKey),
    toTrimmedString(input.codexCommand) || current.codexCommand || DEFAULT_CODEX_COMMAND,
    JSON.stringify(toArgs(input.codexArgs, current.codexArgs)),
    toTrimmedString(input.codexModel) || current.codexModel || DEFAULT_CODEX_MODEL,
    toTrimmedString(input.geminiCommand) || current.geminiCommand || DEFAULT_GEMINI_COMMAND,
    JSON.stringify(toArgs(input.geminiArgs, current.geminiArgs)),
    toTrimmedString(input.geminiModel) || current.geminiModel || DEFAULT_GEMINI_MODEL,
    input.useShellFallback ? 1 : 0,
    toTrimmedString(input.shellOverride),
    now
  )

  return getTerminalAgentSettings(input.agentId, input.widgetId)
}

export function getTerminalAgentDialogState(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
): TerminalAgentDialogState {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      agent_id as agentId,
      widget_id as widgetId,
      provider,
      provider_session_ref as providerSessionRef,
      status,
      last_error as lastError,
      updated_at as updatedAt
    FROM terminal_agent_dialog_state
    WHERE agent_id = ? AND widget_id = ? AND provider = ?
  `).get(agentId, widgetId, provider) as {
    agentId: string
    widgetId: string
    provider: string
    providerSessionRef: string | null
    status: string
    lastError: string | null
    updatedAt: string
  } | undefined

  return {
    agentId,
    widgetId,
    provider,
    providerSessionRef: toTrimmedString(row?.providerSessionRef),
    status: toTrimmedString(row?.status) || 'idle',
    lastError: row?.lastError ?? null,
    updatedAt: row?.updatedAt ?? null,
  }
}

export function upsertTerminalAgentDialogState(input: {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef?: string
  status: string
  lastError?: string | null
}) {
  const db = getDb()
  const now = nowIso()
  const current = getTerminalAgentDialogState(input.agentId, input.widgetId, input.provider)

  db.prepare(`
    INSERT INTO terminal_agent_dialog_state (
      agent_id,
      widget_id,
      provider,
      provider_session_ref,
      status,
      last_error,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, widget_id, provider) DO UPDATE SET
      provider_session_ref = excluded.provider_session_ref,
      status = excluded.status,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run(
    input.agentId,
    input.widgetId,
    input.provider,
    typeof input.providerSessionRef === 'string'
      ? toTrimmedString(input.providerSessionRef)
      : current.providerSessionRef,
    toTrimmedString(input.status) || 'idle',
    typeof input.lastError === 'undefined' ? current.lastError : input.lastError,
    now
  )

  return getTerminalAgentDialogState(input.agentId, input.widgetId, input.provider)
}

export function clearTerminalAgentDialogState(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
) {
  const db = getDb()
  const now = nowIso()
  db.prepare(`
    INSERT INTO terminal_agent_dialog_state (
      agent_id,
      widget_id,
      provider,
      provider_session_ref,
      status,
      last_error,
      updated_at
    ) VALUES (?, ?, ?, '', 'idle', NULL, ?)
    ON CONFLICT(agent_id, widget_id, provider) DO UPDATE SET
      provider_session_ref = '',
      status = 'idle',
      last_error = NULL,
      updated_at = excluded.updated_at
  `).run(agentId, widgetId, provider, now)
}

export function upsertTerminalAgentDialogRef(input: {
  agentId: string
  widgetId: string
  provider: TerminalAgentProvider
  providerSessionRef: string
  lastStatus?: string
}) {
  const ref = toTrimmedString(input.providerSessionRef)
  if (!ref) {
    return null
  }

  const db = getDb()
  const now = nowIso()
  const status = toTrimmedString(input.lastStatus) || 'done'
  db.prepare(`
    INSERT INTO terminal_agent_dialog_refs (
      agent_id,
      widget_id,
      provider,
      provider_session_ref,
      created_at,
      updated_at,
      last_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, widget_id, provider, provider_session_ref) DO UPDATE SET
      updated_at = excluded.updated_at,
      last_status = excluded.last_status
  `).run(
    input.agentId,
    input.widgetId,
    input.provider,
    ref,
    now,
    now,
    status
  )

  return ref
}

export function listTerminalAgentDialogRefs(
  agentId: string,
  widgetId: string,
  provider: TerminalAgentProvider
): TerminalAgentDialogRef[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      agent_id as agentId,
      widget_id as widgetId,
      provider,
      provider_session_ref as providerSessionRef,
      created_at as createdAt,
      updated_at as updatedAt,
      last_status as lastStatus
    FROM terminal_agent_dialog_refs
    WHERE agent_id = ? AND widget_id = ? AND provider = ?
    ORDER BY updated_at DESC
    LIMIT 100
  `).all(agentId, widgetId, provider) as Array<{
    agentId: string
    widgetId: string
    provider: string
    providerSessionRef: string
    createdAt: string
    updatedAt: string
    lastStatus: string
  }>

  return rows.map((row) => ({
    agentId: row.agentId,
    widgetId: row.widgetId,
    provider,
    providerSessionRef: toTrimmedString(row.providerSessionRef),
    createdAt: toTrimmedString(row.createdAt),
    updatedAt: toTrimmedString(row.updatedAt),
    lastStatus: toTrimmedString(row.lastStatus) || 'done',
  }))
}
