#!/usr/bin/env bash
set -euo pipefail

IMAGE=${IMAGE:-ssalgten-updater:latest}
CONTAINER=${CONTAINER:-ssalgten-updater}
WORKSPACE=${WORKSPACE:-/opt/ssalgten}
PORT=${PORT:-8765}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required" >&2
  exit 1
fi

echo "Building updater image..."
docker build -f Dockerfile.updater -t "$IMAGE" .

echo "Restarting container $CONTAINER ..."
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d --name "$CONTAINER" \
  --restart unless-stopped \
  -p "$PORT:8765" \
  -e UPDATER_TOKEN=${UPDATER_TOKEN:-} \
  -e PORT=8765 \
  -e WORKSPACE=/workspace \
  -e UPDATE_SCRIPT=/workspace/scripts/update-frontend.sh \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$WORKSPACE":/workspace \
  "$IMAGE"

echo "Updater is running at :$PORT"
echo "Hint: set UPDATER_TOKEN for security"

