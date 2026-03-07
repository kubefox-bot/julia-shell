import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDb } from './shared';
import * as schema from './core-schema';

export function openCoreDatabase() {
  const sqlite = openDb('core.db');
  return drizzle(sqlite, { schema });
}
