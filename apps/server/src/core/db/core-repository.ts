import { asc, eq } from 'drizzle-orm';
import type { LayoutItem, LayoutSettings, ShellLocale, ShellTheme } from '../../entities/widget/model/types';
import { nowIso } from '@shared/lib/time';
import { openCoreDatabase } from './core-drizzle';
import { moduleStateTable, shellLayoutSettingsTable, widgetLayoutTable } from './core-schema';
import { openDb } from './shared';

function sanitizeLocale(value: string | null | undefined): ShellLocale {
  return value === 'ru' || value === 'en' ? value : 'ru';
}

function sanitizeTheme(value: string | null | undefined): ShellTheme {
  return value === 'auto' || value === 'day' || value === 'night' ? value : 'auto';
}

function hasColumn(db: ReturnType<typeof openDb>, tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function maybeResetLegacyCoreTables(sqlite: ReturnType<typeof openDb>) {
  const shouldResetSettings = !hasColumn(sqlite, 'shell_layout_settings', 'agent_id');
  const shouldResetLayout = !hasColumn(sqlite, 'widget_layout', 'agent_id');
  const shouldResetModules = !hasColumn(sqlite, 'module_state', 'agent_id');

  if (shouldResetSettings) {
    sqlite.exec('DROP TABLE IF EXISTS shell_layout_settings;');
  }

  if (shouldResetLayout) {
    sqlite.exec('DROP TABLE IF EXISTS widget_layout;');
  }

  if (shouldResetModules) {
    sqlite.exec('DROP TABLE IF EXISTS module_state;');
  }
}

function bootstrapCoreSchema() {
  const sqlite = openDb('core.db');
  maybeResetLegacyCoreTables(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shell_layout_settings (
      agent_id TEXT PRIMARY KEY,
      desktop_columns INTEGER NOT NULL DEFAULT 12,
      mobile_columns INTEGER NOT NULL DEFAULT 1,
      locale TEXT NOT NULL DEFAULT 'ru',
      theme TEXT NOT NULL DEFAULT 'auto',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS widget_layout (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id)
    );

    CREATE TABLE IF NOT EXISTS module_state (
      agent_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      disabled_reason TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, widget_id)
    );

    CREATE TABLE IF NOT EXISTS agent_jobs (
      job_id TEXT PRIMARY KEY,
      widget_id TEXT NOT NULL,
      agent_id TEXT,
      session_id TEXT,
      state TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_jobs_state ON agent_jobs(state, updated_at DESC);
  `);

  sqlite.exec(`UPDATE shell_layout_settings SET locale = 'ru' WHERE locale = 'system';`);
}

function getDb(agentId: string) {
  bootstrapCoreSchema();
  const db = openCoreDatabase();

  db.insert(shellLayoutSettingsTable)
    .values({
      agentId,
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'ru',
      theme: 'auto',
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();

  return db;
}

export function getLayoutSettings(agentId: string): LayoutSettings {
  const db = getDb(agentId);
  const row = db
    .select({
      desktopColumns: shellLayoutSettingsTable.desktopColumns,
      mobileColumns: shellLayoutSettingsTable.mobileColumns,
      locale: shellLayoutSettingsTable.locale,
      theme: shellLayoutSettingsTable.theme
    })
    .from(shellLayoutSettingsTable)
    .where(eq(shellLayoutSettingsTable.agentId, agentId))
    .get();

  return row
    ? {
        desktopColumns: row.desktopColumns,
        mobileColumns: row.mobileColumns,
        locale: sanitizeLocale(row.locale),
        theme: sanitizeTheme(row.theme)
      }
    : { desktopColumns: 12, mobileColumns: 1, locale: 'ru', theme: 'auto' };
}

export function saveLayoutSettings(agentId: string, next: LayoutSettings) {
  const db = getDb(agentId);
  db.update(shellLayoutSettingsTable)
    .set({
      desktopColumns: next.desktopColumns,
      mobileColumns: next.mobileColumns,
      locale: sanitizeLocale(next.locale),
      theme: sanitizeTheme(next.theme),
      updatedAt: nowIso()
    })
    .where(eq(shellLayoutSettingsTable.agentId, agentId))
    .run();
}

export function getLayoutItems(agentId: string): LayoutItem[] {
  const db = getDb(agentId);
  return db
    .select({
      widgetId: widgetLayoutTable.widgetId,
      order: widgetLayoutTable.order,
      size: widgetLayoutTable.size
    })
    .from(widgetLayoutTable)
    .where(eq(widgetLayoutTable.agentId, agentId))
    .orderBy(asc(widgetLayoutTable.order))
    .all() as LayoutItem[];
}

export function upsertLayoutItem(agentId: string, item: LayoutItem) {
  const db = getDb(agentId);
  db.insert(widgetLayoutTable)
    .values({
      agentId,
      widgetId: item.widgetId,
      order: item.order,
      size: item.size,
      updatedAt: nowIso()
    })
    .onConflictDoUpdate({
      target: [widgetLayoutTable.agentId, widgetLayoutTable.widgetId],
      set: {
        order: item.order,
        size: item.size,
        updatedAt: nowIso()
      }
    })
    .run();
}

export function replaceLayout(agentId: string, items: LayoutItem[]) {
  const sqlite = openDb('core.db');
  const db = getDb(agentId);

  sqlite.transaction(() => {
    for (const item of items) {
      db.insert(widgetLayoutTable)
        .values({
          agentId,
          widgetId: item.widgetId,
          order: item.order,
          size: item.size,
          updatedAt: nowIso()
        })
        .onConflictDoUpdate({
          target: [widgetLayoutTable.agentId, widgetLayoutTable.widgetId],
          set: {
            order: item.order,
            size: item.size,
            updatedAt: nowIso()
          }
        })
        .run();
    }
  })();
}

export type ModuleStateRow = {
  widgetId: string;
  enabled: boolean;
  disabledReason: string | null;
};

export function getModuleStates(agentId: string): ModuleStateRow[] {
  const db = getDb(agentId);
  return db
    .select({
      widgetId: moduleStateTable.widgetId,
      enabled: moduleStateTable.enabled,
      disabledReason: moduleStateTable.disabledReason
    })
    .from(moduleStateTable)
    .where(eq(moduleStateTable.agentId, agentId))
    .all()
    .map((row) => ({
      widgetId: row.widgetId,
      enabled: Boolean(row.enabled),
      disabledReason: row.disabledReason
    }));
}

export function setModuleEnabled(agentId: string, widgetId: string, enabled: boolean, reason: string | null = null) {
  const db = getDb(agentId);
  db.insert(moduleStateTable)
    .values({
      agentId,
      widgetId,
      enabled,
      disabledReason: reason,
      updatedAt: nowIso()
    })
    .onConflictDoUpdate({
      target: [moduleStateTable.agentId, moduleStateTable.widgetId],
      set: {
        enabled,
        disabledReason: reason,
        updatedAt: nowIso()
      }
    })
    .run();
}

export function ensureDefaultModuleState(agentId: string, widgetId: string, enabled: boolean) {
  const db = getDb(agentId);
  db.insert(moduleStateTable)
    .values({
      agentId,
      widgetId,
      enabled,
      disabledReason: null,
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();
}

export function ensureDefaultLayoutItem(agentId: string, item: LayoutItem) {
  const db = getDb(agentId);
  db.insert(widgetLayoutTable)
    .values({
      agentId,
      widgetId: item.widgetId,
      order: item.order,
      size: item.size,
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();
}

export function purgeAgentCoreState(agentId: string) {
  const db = getDb(agentId);
  db.delete(moduleStateTable).where(eq(moduleStateTable.agentId, agentId)).run();
  db.delete(widgetLayoutTable).where(eq(widgetLayoutTable.agentId, agentId)).run();
  db.delete(shellLayoutSettingsTable).where(eq(shellLayoutSettingsTable.agentId, agentId)).run();
}
