#!/bin/sh

# Generate runtime configuration for frontend
echo "🔧 [ENTRYPOINT] Generating frontend runtime configuration..."

# Debug: Print environment variables
echo "🔍 [DEBUG] Environment variables:"
echo "  VITE_API_URL: ${VITE_API_URL:-not set}"
echo "  VITE_API_BASE_URL: ${VITE_API_BASE_URL:-not set}"
echo "  VITE_APP_NAME: ${VITE_APP_NAME:-not set}"

# Use VITE_API_URL as primary, fallback to VITE_API_BASE_URL
API_URL="${VITE_API_URL:-${VITE_API_BASE_URL:-http://localhost:3001/api}}"

# Ensure the html directory exists
mkdir -p /usr/share/nginx/html

# Create config.js file with runtime environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  API_BASE_URL: "${API_URL}",
  APP_NAME: "${VITE_APP_NAME:-SsalgTen Network Monitor}",
  APP_VERSION: "${VITE_APP_VERSION:-1.0.0}",
  ENABLE_DEBUG: ${VITE_ENABLE_DEBUG:-false},
  MAP_PROVIDER: "${VITE_MAP_PROVIDER:-openstreetmap}",
  MAP_API_KEY: "${VITE_MAP_API_KEY:-}"
};
EOF

# Verify the file was created
if [ -f "/usr/share/nginx/html/config.js" ]; then
    echo "✅ [SUCCESS] Frontend configuration generated successfully"
    echo "📍 [INFO] API_BASE_URL: ${API_URL}"
    echo "📁 [INFO] Config file created at: /usr/share/nginx/html/config.js"
else
    echo "❌ [ERROR] Failed to create config.js file"
    exit 1
fi