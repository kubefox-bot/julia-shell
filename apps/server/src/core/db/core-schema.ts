import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const DEFAULT_DESKTOP_COLUMNS = 12;
const DEFAULT_MOBILE_COLUMNS = 1;

export const shellLayoutSettingsTable = sqliteTable('shell_layout_settings', {
  agentId: text('agent_id').notNull(),
  desktopColumns: integer('desktop_columns').notNull().default(DEFAULT_DESKTOP_COLUMNS),
  mobileColumns: integer('mobile_columns').notNull().default(DEFAULT_MOBILE_COLUMNS),
  locale: text('locale').notNull().default('system'),
  theme: text('theme').notNull().default('auto'),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  primaryKey({ columns: [table.agentId] })
]);

export const widgetLayoutTable = sqliteTable('widget_layout', {
  agentId: text('agent_id').notNull(),
  widgetId: text('widget_id').notNull(),
  order: integer('order_index').notNull(),
  size: text('size').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  primaryKey({ columns: [table.agentId, table.widgetId] })
]);

export const moduleStateTable = sqliteTable('module_state', {
  agentId: text('agent_id').notNull(),
  widgetId: text('widget_id').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  disabledReason: text('disabled_reason'),
  updatedAt: text('updated_at').notNull()
}, (table) => [
  primaryKey({ columns: [table.agentId, table.widgetId] })
]);
