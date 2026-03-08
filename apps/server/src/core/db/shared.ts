import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const defaultDataDir = path.join(process.cwd(), 'data');

export function getDataDir() {
  const fromEnv = process.env.JULIAAPP_DATA_DIR?.trim();
  return fromEnv ? path.resolve(fromEnv) : defaultDataDir;
}

const dbCache = new Map<string, Database.Database>();

export function openDb(fileName: string) {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const fullPath = path.join(dataDir, fileName);

  let db = dbCache.get(fullPath);
  if (!db) {
    db = new Database(fullPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    dbCache.set(fullPath, db);
  }

  return db;
}

export function resetDbCache() {
  for (const db of dbCache.values()) {
    db.close();
  }
  dbCache.clear();
}
