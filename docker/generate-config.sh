#!/bin/sh

# Generate runtime configuration for frontend
echo "Generating frontend runtime configuration..."

# Create config.js file with runtime environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  API_BASE_URL: "${VITE_API_BASE_URL:-http://localhost:3001/api}",
  APP_NAME: "${VITE_APP_NAME:-SsalgTen Network Monitor}",
  APP_VERSION: "${VITE_APP_VERSION:-1.0.0}",
  ENABLE_DEBUG: ${VITE_ENABLE_DEBUG:-false},
  MAP_PROVIDER: "${VITE_MAP_PROVIDER:-openstreetmap}",
  MAP_API_KEY: "${VITE_MAP_API_KEY:-}"
};
EOF

echo "Frontend configuration generated successfully"
echo "API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:3001/api}"