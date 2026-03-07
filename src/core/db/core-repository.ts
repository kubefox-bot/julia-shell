import { nowIso } from '../../shared/lib/time';
import type { LayoutItem, LayoutSettings } from '../../entities/widget/model/types';
import { openDb } from './shared';

function getDb() {
  const db = openDb('core.db');

  db.exec(`
    CREATE TABLE IF NOT EXISTS shell_layout_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      desktop_columns INTEGER NOT NULL DEFAULT 12,
      mobile_columns INTEGER NOT NULL DEFAULT 1,
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
  `);

  db.prepare(`
    INSERT OR IGNORE INTO shell_layout_settings (id, desktop_columns, mobile_columns, updated_at)
    VALUES (1, 12, 1, ?)
  `).run(nowIso());

  return db;
}

export function getLayoutSettings(): LayoutSettings {
  const db = getDb();
  const row = db
    .prepare('SELECT desktop_columns as desktopColumns, mobile_columns as mobileColumns FROM shell_layout_settings WHERE id = 1')
    .get() as LayoutSettings | undefined;

  return row ?? { desktopColumns: 12, mobileColumns: 1 };
}

export function saveLayoutSettings(next: LayoutSettings) {
  const db = getDb();
  db.prepare(`
    UPDATE shell_layout_settings
    SET desktop_columns = @desktopColumns,
        mobile_columns = @mobileColumns,
        updated_at = @updatedAt
    WHERE id = 1
  `).run({
    desktopColumns: next.desktopColumns,
    mobileColumns: next.mobileColumns,
    updatedAt: nowIso()
  });
}

export function getLayoutItems(): LayoutItem[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT widget_id as widgetId, order_index as "order", size FROM widget_layout ORDER BY order_index ASC')
    .all() as LayoutItem[];

  return rows;
}

export function upsertLayoutItem(item: LayoutItem) {
  const db = getDb();
  db.prepare(`
    INSERT INTO widget_layout (widget_id, order_index, size, updated_at)
    VALUES (@widgetId, @order, @size, @updatedAt)
    ON CONFLICT(widget_id) DO UPDATE SET
      order_index = excluded.order_index,
      size = excluded.size,
      updated_at = excluded.updated_at
  `).run({
    widgetId: item.widgetId,
    order: item.order,
    size: item.size,
    updatedAt: nowIso()
  });
}

export function replaceLayout(items: LayoutItem[]) {
  const db = getDb();
  const transaction = db.transaction((rows: LayoutItem[]) => {
    for (const row of rows) {
      upsertLayoutItem(row);
    }
  });

  transaction(items);
}

export type ModuleStateRow = {
  widgetId: string;
  enabled: boolean;
  disabledReason: string | null;
};

export function getModuleStates(): ModuleStateRow[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT widget_id as widgetId, enabled, disabled_reason as disabledReason FROM module_state')
    .all() as Array<{ widgetId: string; enabled: number; disabledReason: string | null }>;

  return rows.map((row) => ({
    widgetId: row.widgetId,
    enabled: row.enabled === 1,
    disabledReason: row.disabledReason
  }));
}

export function setModuleEnabled(widgetId: string, enabled: boolean, reason: string | null = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO module_state (widget_id, enabled, disabled_reason, updated_at)
    VALUES (@widgetId, @enabled, @reason, @updatedAt)
    ON CONFLICT(widget_id) DO UPDATE SET
      enabled = excluded.enabled,
      disabled_reason = excluded.disabled_reason,
      updated_at = excluded.updated_at
  `).run({
    widgetId,
    enabled: enabled ? 1 : 0,
    reason,
    updatedAt: nowIso()
  });
}

export function ensureDefaultModuleState(widgetId: string, enabled: boolean) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO module_state (widget_id, enabled, disabled_reason, updated_at)
    VALUES (@widgetId, @enabled, NULL, @updatedAt)
  `).run({
    widgetId,
    enabled: enabled ? 1 : 0,
    updatedAt: nowIso()
  });
}

export function ensureDefaultLayoutItem(item: LayoutItem) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO widget_layout (widget_id, order_index, size, updated_at)
    VALUES (@widgetId, @order, @size, @updatedAt)
  `).run({
    widgetId: item.widgetId,
    order: item.order,
    size: item.size,
    updatedAt: nowIso()
  });
}
