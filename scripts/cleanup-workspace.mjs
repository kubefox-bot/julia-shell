import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const CLEANUP_PATHS = [
  'node_modules',
  '.astro',
  'dist',
  'coverage',
  'apps/server/node_modules',
  'apps/server/.astro',
  'apps/server/dist',
  'apps/server/coverage',
  'apps/server/dev.stdout.log',
  'apps/server/dev.stderr.log',
  'apps/agent/node_modules',
  'apps/agent/target',
  'packages/protocol/node_modules'
];

async function removePath(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  await rm(absolutePath, { recursive: true, force: true });
  console.log(`[cleanup] removed ${relativePath}`);
}

function hasCargo() {
  const result = spawnSync('cargo', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function runCargoClean() {
  const result = spawnSync('cargo', ['clean', '--manifest-path', 'apps/agent/Cargo.toml'], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error('cargo clean failed');
  }
}

console.log('[cleanup] workspace cleanup started');

for (const cleanupPath of CLEANUP_PATHS) {
  await removePath(cleanupPath);
}

if (hasCargo()) {
  runCargoClean();
} else {
  console.log('[cleanup] cargo not found, skip cargo clean');
}

console.log('[cleanup] workspace cleanup completed');
