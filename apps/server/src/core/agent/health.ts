const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000;
const MIN_HEARTBEAT_TIMEOUT_MS = 5_000;
const MAX_HEARTBEAT_TIMEOUT_MS = 10 * 60_000;

function clampTimeout(value: number) {
  return Math.max(MIN_HEARTBEAT_TIMEOUT_MS, Math.min(MAX_HEARTBEAT_TIMEOUT_MS, value));
}

export function resolveAgentHeartbeatTimeoutMs() {
  const raw = process.env.JULIA_AGENT_HEARTBEAT_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_HEARTBEAT_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HEARTBEAT_TIMEOUT_MS;
  }

  return clampTimeout(Math.round(parsed));
}

export function isStaleHeartbeat(input: {
  lastHeartbeatAt: string;
  timeoutMs: number;
  nowMs?: number;
}) {
  const heartbeatMs = new Date(input.lastHeartbeatAt).getTime();
  if (!Number.isFinite(heartbeatMs)) {
    return true;
  }

  const nowMs = input.nowMs ?? Date.now();
  return nowMs - heartbeatMs > input.timeoutMs;
}
