import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const shellLayoutSettingsTable = sqliteTable('shell_layout_settings', {
  id: integer('id').primaryKey(),
  desktopColumns: integer('desktop_columns').notNull().default(12),
  mobileColumns: integer('mobile_columns').notNull().default(1),
  locale: text('locale').notNull().default('system'),
  theme: text('theme').notNull().default('auto'),
  updatedAt: text('updated_at').notNull()
});

export const widgetLayoutTable = sqliteTable('widget_layout', {
  widgetId: text('widget_id').primaryKey(),
  order: integer('order_index').notNull(),
  size: text('size').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const moduleStateTable = sqliteTable('module_state', {
  widgetId: text('widget_id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  disabledReason: text('disabled_reason'),
  updatedAt: text('updated_at').notNull()
});
