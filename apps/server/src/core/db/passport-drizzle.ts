import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDb } from './shared';
import * as schema from './passport-schema';

export function openPassportSqlite() {
  return openDb('passport.db');
}

export function openPassportDatabase() {
  return drizzle(openPassportSqlite(), { schema });
}
