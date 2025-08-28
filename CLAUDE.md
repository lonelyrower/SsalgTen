# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

SsalgTen is a production-ready distributed network monitoring system inspired by Looking Glass networks. It consists of four main components:

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

## Key Technologies

- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens, bcrypt password hashing
- **Frontend**: React 18, TailwindCSS, shadcn/ui, Leaflet maps, Recharts
- **Backend**: Express, Socket.IO for real-time updates, helmet for security
- **Agent**: Cross-platform network diagnostics (ping, traceroute, MTR, speedtest)

## Database Schema

The system uses a comprehensive PostgreSQL schema with these key models:
- `Node`: Represents each monitoring agent/probe location
- `DiagnosticRecord`: Stores network test results
- `HeartbeatLog`: Agent status and system metrics
- `User`: Admin users with role-based access (ADMIN/OPERATOR/VIEWER)
- `RefreshToken`: JWT refresh token management
- `VisitorLog`: Track API/web usage
- `Setting`: System configuration storage

## Core Business Logic

### Agent Registration and Heartbeats
- Agents auto-register with the backend using API keys
- Send heartbeat every 30 seconds with system metrics
- Backend tracks agent status and updates node records

### Network Diagnostics
- Agents perform ping, traceroute, MTR, and speedtest operations
- Results are stored in `DiagnosticRecord` with detailed JSON data
- Real-time updates sent via WebSocket to connected clients

### User Management
- Role-based access control with JWT authentication
- Refresh token system for secure session management
- Admin interface for user/node/system management

## API Structure

**Backend API Endpoints:**
- `/api/auth/*` - Authentication (login/logout/refresh)
- `/api/admin/*` - Admin management functions
- `/api/nodes/*` - Node management and status
- `/api/diagnostics/*` - Network diagnostic operations
- `/api/visitors/*` - Visitor tracking
- `/api/system/version` - System version information (public)
- `/api/admin/system/update` - System update operations (admin only)

**Agent API Endpoints:**
- `/api/diagnostics/*` - Execute network tests
- `/api/health` - Health check
- `/health` - Simple health endpoint

**Updater Service Endpoints:**
- `/health` - Health check
- `/update` - Trigger system update (requires X-Updater-Token)
- `/jobs` - List update jobs
- `/jobs/:id` - Get specific job status and logs

## Configuration

Environment variables are managed through:
- Root `.env` file for Docker Compose
- `backend/.env` for backend-specific config
- `frontend/.env` for frontend build-time variables
- `agent/.env` for agent configuration

Key configuration areas:
- Database connection strings
- JWT secrets and expiration
- API keys for agent authentication
- Geographic coordinates for agent locations
- Network test parameters (ping count, traceroute hops, etc.)
- System update configuration (UPDATER_TOKEN, GitHub repository settings)

## Testing

```bash
# Run backend tests
cd backend && npm test

# Smoke test entire system
npm run smoke:test

# Manual testing of specific components
cd backend && npm run db:studio  # Check database
curl http://localhost:3001/api/health  # Test API
```

## Production Deployment

The system is designed for Docker deployment with zero-downtime updates:
- Complete Docker Compose setup with PostgreSQL, Redis, and Updater service
- Health checks for all services
- Volume persistence for data
- Environment-based configuration
- HTTPS support via Caddy reverse proxy
- Integrated update system with automatic backup/rollback capabilities
- Web-based update interface in admin panel (System Management → System Overview)

Default admin credentials: admin/admin123 (change immediately in production)

**System Update Feature:**
- Access via admin panel: Login → System Management → System Overview → System Update
- Zero-downtime updates with automatic data backup
- Real-time update progress tracking
- Automatic rollback on failure
- Manual rollback capability via scripts

## Key Files and Directories

- `backend/prisma/schema.prisma` - Complete database schema
- `backend/src/controllers/` - API endpoint handlers
- `backend/src/services/` - Business logic services
- `frontend/src/components/` - React components (admin, map, dashboard)
- `frontend/src/services/api.ts` - Frontend API service layer
- `agent/src/services/` - Network diagnostic implementations
- `docker-compose.yml` - Production deployment configuration
- `scripts/update-production.sh` - Production update script with backup/rollback
- `scripts/rollback.sh` - Manual rollback script
- `scripts/test-update-system.sh` - Update system validation
- `Dockerfile.updater` - Updater service container definition
- `scripts/updater-server.mjs` - Updater service implementation
- `UPDATE_SYSTEM.md` - System update user guide
- `docs/PRODUCTION_UPDATE.md` - Detailed production update documentation