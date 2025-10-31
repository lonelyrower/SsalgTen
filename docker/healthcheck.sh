#!/bin/sh

# Health check script for SsalgTen services
# This script is used by Docker health checks

SERVICE_TYPE=${SERVICE_TYPE:-backend}
PORT=${PORT:-3001}
ENDPOINT=${ENDPOINT:-/api/health}

case $SERVICE_TYPE in
    "backend")
        # Check backend API health
        if wget --no-verbose --tries=1 --timeout=10 --spider "http://localhost:$PORT$ENDPOINT" 2>/dev/null; then
            echo "Backend service is healthy"
            exit 0
        else
            echo "Backend service is unhealthy"
            exit 1
        fi
        ;;
    "agent")
        # Check agent service health
        if wget --no-verbose --tries=1 --timeout=10 --spider "http://localhost:$PORT$ENDPOINT" 2>/dev/null; then
            echo "Agent service is healthy"
            exit 0
        else
            echo "Agent service is unhealthy"
            exit 1
        fi
        ;;
    "frontend")
        # Check frontend nginx health
        if wget --no-verbose --tries=1 --timeout=10 --spider "http://localhost:80/health" 2>/dev/null; then
            echo "Frontend service is healthy"
            exit 0
        else
            echo "Frontend service is unhealthy"
            exit 1
        fi
        ;;
    *)
        echo "Unknown service type: $SERVICE_TYPE"
        exit 1
        ;;
esac