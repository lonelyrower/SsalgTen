#!/bin/sh

# Inject environment variables into the built frontend application
# This script replaces placeholder values with actual environment variables

echo "Injecting environment variables into frontend..."

# Define the target file
TARGET_FILE="/usr/share/nginx/html/assets/index*.js"

# List of environment variables to inject
VARS_TO_REPLACE="
VITE_API_BASE_URL
VITE_APP_NAME
VITE_APP_VERSION
VITE_ENABLE_DEBUG
VITE_MAP_PROVIDER
VITE_MAP_API_KEY
"

# Function to replace placeholders with environment variables
inject_var() {
    local var_name=$1
    local var_value=$(printenv $var_name)
    
    if [ -n "$var_value" ]; then
        echo "Injecting $var_name=$var_value"
        
        # Use a more specific placeholder pattern
        local placeholder="__${var_name}__"
        
        # Replace in all matching JS files
        for file in $TARGET_FILE; do
            if [ -f "$file" ]; then
                sed -i "s|$placeholder|$var_value|g" "$file"
            fi
        done
    else
        echo "Warning: Environment variable $var_name is not set"
    fi
}

# Inject all defined variables
for var in $VARS_TO_REPLACE; do
    inject_var $var
done

echo "Environment variable injection completed"