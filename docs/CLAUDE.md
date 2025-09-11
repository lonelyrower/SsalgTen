# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

SsalgTen is a production-ready distributed network monitoring system for global network visibility. It consists of four main components:

- **Frontend** (React + TypeScript + Vite): Modern web interface with real-time map visualization, dashboard, and admin panels
- **Backend** (Node.js + Express + TypeScript): REST API server with JWT authentication, PostgreSQL database, and WebSocket support
- **Agent** (Node.js + TypeScript): Lightweight diagnostic probes that run network tests and report back to the backend
- **Updater Service** (Node.js + Express): Zero-downtime update system for production deployments with automatic backup/rollback

The system uses a hub-and-spoke architecture where multiple agents worldwide report to a central backend server, providing global network visibility. The integrated update system allows for safe production updates through a web interface.

## Development Commands

### Root Workspace Commands
```bash
# Start all services for development (includes database)
npm run dev

# Install dependencies for all projects
npm run install:all

# Build all projects for production
npm run build

# Clean all build artifacts
npm run clean

# Lint all code
npm run lint

# Type check all TypeScript
npm run type-check

# Run smoke tests
npm run smoke:test

# Setup development environment with database migration and seeding
npm run dev:setup

# Start database only for development
npm run dev:db
```

### Individual Service Commands

**Backend:**
```bash
cd backend
npm run dev              # Development with nodemon
npm run build           # Compile TypeScript
npm run start           # Production server
npm run db:migrate      # Run Prisma migrations
npm run db:studio       # Open Prisma Studio
npm run db:seed         # Seed database
npm run db:update-asn   # Update ASN data
```

**Frontend:**
```bash
cd frontend
npm run dev       # Development server with hot reload
npm run build     # Production build
npm run preview   # Preview production build
```

**Agent:**
```bash
cd agent
npm run dev     # Development with nodemon
npm run build   # Compile TypeScript
npm run start   # Production agent
```

### Database Operations

The project uses Prisma with PostgreSQL. Key database commands:
```bash
cd backend
npx prisma migrate dev    # Create and apply migration
npx prisma db push       # Push schema changes without migration
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # GUI for database
```

### Docker Operations

```bash
# Start all services (production)
docker compose up -d

# Development with database only
npm run dev:db

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### System Update Operations

The system includes a production-ready zero-downtime update feature:

```bash
# Test update system readiness
./scripts/test-update-system.sh

# Manual update trigger (requires UPDATER_TOKEN)
curl -X POST http://localhost:8765/update \
  -H "X-Updater-Token: your-token" \
  -H "Content-Type: application/json"

# Manual rollback to specific backup
./scripts/rollback.sh BACKUP_ID
```
