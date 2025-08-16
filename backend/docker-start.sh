#!/bin/sh
set -e

echo "[startup] Starting SsalgTen backend container..."
START_TIME=$(date +%s)

# Wait for Postgres TCP readiness (defensive even with depends_on)
DB_WAIT_TIMEOUT=${DB_WAIT_TIMEOUT:-60}
if [ -n "${DATABASE_URL}" ]; then
  echo "[startup] Waiting for database to accept connections (timeout=${DB_WAIT_TIMEOUT}s)..."
  ATTEMPT=0
  until node -e "const {Client}=require('pg');(async()=>{try{const u=process.env.DATABASE_URL;const c=new Client({connectionString:u});await c.connect();await c.query('SELECT 1');await c.end();}catch(e){process.exit(1)}})();" 2>/dev/null; do
    ATTEMPT=$((ATTEMPT+1))
    if [ ${ATTEMPT} -ge ${DB_WAIT_TIMEOUT} ]; then
      echo "[startup][error] Database not reachable after ${DB_WAIT_TIMEOUT}s" >&2
      exit 1
    fi
    sleep 1
  done
  echo "[startup] Database reachable."
fi

# Allow overriding (disable auto-migrate) via env
if [ "${DISABLE_DB_MIGRATE}" = "true" ]; then
  echo "[startup] Database auto migration disabled via DISABLE_DB_MIGRATE=true"
else
  if [ -n "${DATABASE_URL}" ]; then
    echo "[startup] Running prisma migrate deploy..."
    npx prisma migrate deploy || echo "[startup][warn] migrate deploy failed (might be first run without migrations)"
    echo "[startup] Generating prisma client (safety)..."
    npx prisma generate || true
  else
    echo "[startup][warn] DATABASE_URL not set, skipping migrations"
  fi
fi

# Seed admin & system settings if not existing yet
if [ "${DISABLE_DB_SEED}" = "true" ]; then
  echo "[startup] Seed disabled via DISABLE_DB_SEED=true"
else
  # Only run seed if User table empty (no admin) to keep idempotent
  if [ -n "${DATABASE_URL}" ]; then
    ADMIN_COUNT=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>{console.log(c);}).catch(()=>console.log('0')).finally(()=>p.$disconnect());")
    if [ "${ADMIN_COUNT}" = "0" ]; then
      echo "[startup] Seeding admin user & settings..."
      node dist/utils/seed.js || echo "[startup][warn] seed script failed"
    else
      echo "[startup] Existing users detected (${ADMIN_COUNT}), skipping seed"
    fi
  fi
fi

echo "[startup] Launching application..."
node dist/server.js &
APP_PID=$!

# Optional wait for port before declaring success (PORT env or default 3001)
APP_PORT=${PORT:-3001}
PORT_WAIT_TIMEOUT=${PORT_WAIT_TIMEOUT:-30}
echo "[startup] Waiting for app port ${APP_PORT} (timeout=${PORT_WAIT_TIMEOUT}s)..."
ATTEMPT=0
until node -e "require('http').get('http://localhost:${APP_PORT}/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1));" 2>/dev/null; do
  ATTEMPT=$((ATTEMPT+1))
  if [ ${ATTEMPT} -ge ${PORT_WAIT_TIMEOUT} ]; then
    echo "[startup][warn] App health endpoint not ready after ${PORT_WAIT_TIMEOUT}s; continuing (healthcheck will retry)."
    break
  fi
  sleep 1
done

ELAPSED=$(( $(date +%s) - START_TIME ))
echo "[startup] Startup sequence complete in ${ELAPSED}s (PID=${APP_PID})."
wait ${APP_PID}
