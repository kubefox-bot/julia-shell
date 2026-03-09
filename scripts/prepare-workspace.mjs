import { spawnSync } from 'node:child_process';

function hasCargo() {
  const result = spawnSync('cargo', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

console.log('[prepare] workspace prepare started');
console.log('[prepare] yarn install already resolved server dependencies');

if (!hasCargo()) {
  console.log('[prepare] cargo not found, skip Rust dependency fetch');
  process.exit(0);
}

run('cargo', ['fetch', '--locked', '--manifest-path', 'apps/agent/Cargo.toml']);
console.log('[prepare] rust dependencies fetched');
