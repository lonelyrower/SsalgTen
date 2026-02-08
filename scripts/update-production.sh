#!/usr/bin/env bash
set -euo pipefail

# Non-interactive update wrapper used by the updater service.
# Delegates to scripts/ssalgten.sh and is safe to run inside a mounted workspace.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$WORKSPACE_DIR"

UPDATE_MODE="${UPDATE_MODE:-image}" # image | source

# Enable the "agent" compose profile if requested.
if [[ "${FORCE_ENABLE_AGENT:-}" == "true" ]] || [[ "${FORCE_ENABLE_AGENT:-}" == "1" ]]; then
  if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
    if [[ ",${COMPOSE_PROFILES}," != *",agent,"* ]]; then
      export COMPOSE_PROFILES="${COMPOSE_PROFILES},agent"
    fi
  else
    export COMPOSE_PROFILES="agent"
  fi
fi

ARGS=(--non-interactive)

case "$UPDATE_MODE" in
  image|images|ghcr)
    ARGS+=(update --image)
    ;;
  source|git)
    ARGS+=(update --source)
    ;;
  *)
    echo "Unknown UPDATE_MODE: $UPDATE_MODE (expected image|source)" >&2
    exit 2
    ;;
esac

exec "$SCRIPT_DIR/ssalgten.sh" "${ARGS[@]}"

