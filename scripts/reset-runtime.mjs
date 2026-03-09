import { execSync, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const targetPorts = [4321, 50051];
const targetProcessHints = [
  'astro dev',
  'dist/server/entry.mjs',
  'julia-agent',
  'start-agent'
];

function log(message) {
  console.log(`[reset] ${message}`);
}

function run(command, options = {}) {
  return spawnSync(command, {
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  });
}

function collectPidsFromWindowsPort(port) {
  const cmd = `netstat -ano -p tcp | findstr ":${port}"`;
  const result = run(cmd);
  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const columns = trimmed.split(/\s+/);
    const state = columns[3]?.toUpperCase();
    const pid = Number(columns[4]);
    if (state === 'LISTENING' && Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }
  return Array.from(pids);
}

function collectPidsFromUnixPort(port) {
  const result = run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`);
  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }
  return Array.from(
    new Set(
      result.stdout
        .split(/\r?\n/)
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

function collectPidsFromPort(port) {
  return isWindows ? collectPidsFromWindowsPort(port) : collectPidsFromUnixPort(port);
}

function killPids(pids, { force = false } = {}) {
  if (pids.length === 0) {
    return;
  }
  const uniquePids = Array.from(new Set(pids));
  const pidList = uniquePids.join(' ');

  if (isWindows) {
    const forceFlag = force ? '/F ' : '';
    run(`taskkill ${forceFlag}/T /PID ${uniquePids.join(' /PID ')}`);
    return;
  }

  const signal = force ? '-KILL' : '-TERM';
  run(`kill ${signal} ${pidList}`);
}

function collectPidsByHint(hint) {
  if (isWindows) {
    const escaped = hint.replace(/"/g, '\\"');
    const command = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '${escaped}' -or $_.Name -match '${escaped}' } | Select-Object -ExpandProperty ProcessId"`;
    const result = run(command);
    if (result.status !== 0 || !result.stdout.trim()) {
      return [];
    }
    return result.stdout
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  const result = run(`pgrep -f "${hint.replace(/"/g, '\\"')}"`);
  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function flushRouteCacheIfSupported() {
  if (!isWindows) {
    return;
  }

  try {
    execSync('route -f', { stdio: 'pipe' });
    log('route cache flushed (Windows route -f).');
  } catch {
    log('route cache flush skipped (insufficient permissions or unsupported shell).');
  }
}

function main() {
  log('runtime reset started');

  const pidsByPort = new Set();
  for (const port of targetPorts) {
    const pids = collectPidsFromPort(port);
    if (pids.length > 0) {
      log(`port ${port} listeners found: ${pids.join(', ')}`);
      for (const pid of pids) pidsByPort.add(pid);
    } else {
      log(`port ${port} has no listeners`);
    }
  }

  const pidsByHint = new Set();
  for (const hint of targetProcessHints) {
    const pids = collectPidsByHint(hint);
    for (const pid of pids) {
      pidsByHint.add(pid);
    }
  }

  const ownPid = process.pid;
  const combined = Array.from(new Set([...pidsByPort, ...pidsByHint])).filter((pid) => pid !== ownPid);

  if (combined.length === 0) {
    log('no target processes found');
    flushRouteCacheIfSupported();
    log('runtime reset completed');
    return;
  }

  log(`stopping pids: ${combined.join(', ')}`);
  killPids(combined, { force: false });

  const survivors = combined.filter((pid) => {
    if (isWindows) {
      const result = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      return result.status === 0 && result.stdout.includes(`"${pid}"`);
    }
    const result = run(`ps -p ${pid} -o pid=`);
    return result.status === 0 && result.stdout.trim().length > 0;
  });

  if (survivors.length > 0) {
    log(`force killing remaining pids: ${survivors.join(', ')}`);
    killPids(survivors, { force: true });
  }

  flushRouteCacheIfSupported();
  log('runtime reset completed');
}

main();
