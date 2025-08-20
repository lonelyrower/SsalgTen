#!/bin/sh

echo "🚀 [CUSTOM-ENTRYPOINT] Starting SsalgTen frontend container..."

# Ensure config generation runs first
echo "🔧 [CUSTOM-ENTRYPOINT] Running configuration generation..."
/docker-entrypoint.d/40-generate-config.sh

# Now run the original nginx entrypoint
echo "🌐 [CUSTOM-ENTRYPOINT] Starting nginx with original entrypoint..."
exec /docker-entrypoint.sh "$@"