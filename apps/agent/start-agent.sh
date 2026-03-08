#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${JULIA_AGENT_ENV_FILE:-$SCRIPT_DIR/.env}"

load_env_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"

    key="$(echo "$key" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    value="$(echo "$value" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"

    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file_path"
}

resolve_binary() {
  local candidates=()

  if [[ -n "${JULIA_AGENT_BIN:-}" ]]; then
    candidates+=("$JULIA_AGENT_BIN")
  fi

  candidates+=(
    "$SCRIPT_DIR/julia-agent"
    "$SCRIPT_DIR/target/release/julia-agent"
    "$SCRIPT_DIR/target/debug/julia-agent"
  )

  for bin in "${candidates[@]}"; do
    if [[ -x "$bin" ]]; then
      echo "$bin"
      return 0
    fi
  done

  return 1
}

load_env_file "$ENV_FILE"

if agent_bin="$(resolve_binary)"; then
  echo "[agent] starting binary: $agent_bin"
  exec "$agent_bin"
fi

if command -v cargo >/dev/null 2>&1; then
  echo "[agent] binary not found, fallback to cargo run"
  exec cargo run --manifest-path "$SCRIPT_DIR/Cargo.toml"
fi

echo "[agent] error: binary not found and cargo is unavailable" >&2
exit 1
