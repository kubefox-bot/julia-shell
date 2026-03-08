import { asc, eq } from 'drizzle-orm';
import { nowIso } from '../../shared/lib/time';
import type { LayoutItem, LayoutSettings, ShellLocale, ShellTheme } from '../../entities/widget/model/types';
import { openDb } from './shared';
import { openCoreDatabase } from './core-drizzle';
import { moduleStateTable, shellLayoutSettingsTable, widgetLayoutTable } from './core-schema';

function sanitizeLocale(value: string | null | undefined): ShellLocale {
  if (value === 'ru' || value === 'en' || value === 'system') {
    return value;
  }

  return 'system';
}

function sanitizeTheme(value: string | null | undefined): ShellTheme {
  if (value === 'auto' || value === 'day' || value === 'night') {
    return value;
  }

  return 'auto';
}

function ensureSettingsColumns() {
  const sqlite = openDb('core.db');
  const rows = sqlite.prepare('PRAGMA table_info(shell_layout_settings)').all() as Array<{ name: string }>;
  const hasLocaleColumn = rows.some((row) => row.name === 'locale');
  const hasThemeColumn = rows.some((row) => row.name === 'theme');

  if (!hasLocaleColumn) {
    sqlite.exec("ALTER TABLE shell_layout_settings ADD COLUMN locale TEXT NOT NULL DEFAULT 'system'");
  }

  if (!hasThemeColumn) {
    sqlite.exec("ALTER TABLE shell_layout_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'auto'");
  }
}

function bootstrapCoreSchema() {
  const sqlite = openDb('core.db');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shell_layout_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      desktop_columns INTEGER NOT NULL DEFAULT 12,
      mobile_columns INTEGER NOT NULL DEFAULT 1,
      locale TEXT NOT NULL DEFAULT 'system',
      theme TEXT NOT NULL DEFAULT 'auto',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS widget_layout (
      widget_id TEXT PRIMARY KEY,
      order_index INTEGER NOT NULL,
      size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large')),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_state (
      widget_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      disabled_reason TEXT,
      updated_at TEXT NOT NULL
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

  ensureSettingsColumns();
}

function getDb() {
  bootstrapCoreSchema();
  const db = openCoreDatabase();

  db.insert(shellLayoutSettingsTable)
    .values({
      id: 1,
      desktopColumns: 12,
      mobileColumns: 1,
      locale: 'system',
      theme: 'auto',
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();

  return db;
}

export function getLayoutSettings(): LayoutSettings {
  const db = getDb();
  const row = db
    .select({
      desktopColumns: shellLayoutSettingsTable.desktopColumns,
      mobileColumns: shellLayoutSettingsTable.mobileColumns,
      locale: shellLayoutSettingsTable.locale,
      theme: shellLayoutSettingsTable.theme
    })
    .from(shellLayoutSettingsTable)
    .where(eq(shellLayoutSettingsTable.id, 1))
    .get();

  return row
    ? {
        desktopColumns: row.desktopColumns,
        mobileColumns: row.mobileColumns,
        locale: sanitizeLocale(row.locale),
        theme: sanitizeTheme(row.theme)
      }
    : { desktopColumns: 12, mobileColumns: 1, locale: 'system', theme: 'auto' };
}

export function saveLayoutSettings(next: LayoutSettings) {
  const db = getDb();
  db.update(shellLayoutSettingsTable)
    .set({
      desktopColumns: next.desktopColumns,
      mobileColumns: next.mobileColumns,
      locale: sanitizeLocale(next.locale),
      theme: sanitizeTheme(next.theme),
      updatedAt: nowIso()
    })
    .where(eq(shellLayoutSettingsTable.id, 1))
    .run();
}

export function getLayoutItems(): LayoutItem[] {
  const db = getDb();
  return db
    .select({
      widgetId: widgetLayoutTable.widgetId,
      order: widgetLayoutTable.order,
      size: widgetLayoutTable.size
    })
    .from(widgetLayoutTable)
    .orderBy(asc(widgetLayoutTable.order))
    .all() as LayoutItem[];
}

export function upsertLayoutItem(item: LayoutItem) {
  const db = getDb();
  db.insert(widgetLayoutTable)
    .values({
      widgetId: item.widgetId,
      order: item.order,
      size: item.size,
      updatedAt: nowIso()
    })
    .onConflictDoUpdate({
      target: widgetLayoutTable.widgetId,
      set: {
        order: item.order,
        size: item.size,
        updatedAt: nowIso()
      }
    })
    .run();
}

export function replaceLayout(items: LayoutItem[]) {
  const sqlite = openDb('core.db');
  const db = getDb();

  sqlite.transaction(() => {
    for (const item of items) {
      db.insert(widgetLayoutTable)
        .values({
          widgetId: item.widgetId,
          order: item.order,
          size: item.size,
          updatedAt: nowIso()
        })
        .onConflictDoUpdate({
          target: widgetLayoutTable.widgetId,
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

export function getModuleStates(): ModuleStateRow[] {
  const db = getDb();
  return db
    .select({
      widgetId: moduleStateTable.widgetId,
      enabled: moduleStateTable.enabled,
      disabledReason: moduleStateTable.disabledReason
    })
    .from(moduleStateTable)
    .all()
    .map((row) => ({
      widgetId: row.widgetId,
      enabled: Boolean(row.enabled),
      disabledReason: row.disabledReason
    }));
}

export function setModuleEnabled(widgetId: string, enabled: boolean, reason: string | null = null) {
  const db = getDb();
  db.insert(moduleStateTable)
    .values({
      widgetId,
      enabled,
      disabledReason: reason,
      updatedAt: nowIso()
    })
    .onConflictDoUpdate({
      target: moduleStateTable.widgetId,
      set: {
        enabled,
        disabledReason: reason,
        updatedAt: nowIso()
      }
    })
    .run();
}

export function ensureDefaultModuleState(widgetId: string, enabled: boolean) {
  const db = getDb();
  db.insert(moduleStateTable)
    .values({
      widgetId,
      enabled,
      disabledReason: null,
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();
}

export function ensureDefaultLayoutItem(item: LayoutItem) {
  const db = getDb();
  db.insert(widgetLayoutTable)
    .values({
      widgetId: item.widgetId,
      order: item.order,
      size: item.size,
      updatedAt: nowIso()
    })
    .onConflictDoNothing()
    .run();
}
