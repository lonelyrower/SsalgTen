#!/bin/sh
set -e

echo "[startup] Starting SsalgTen backend container..."

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
exec node dist/server.js
