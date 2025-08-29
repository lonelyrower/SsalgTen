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
- `scripts/uninstall.sh` - Comprehensive system uninstall script with web server cleanup
- `scripts/deploy-production.sh` - Production deployment script with interactive setup
- `UPDATE_SYSTEM.md` - System update user guide
- `docs/PRODUCTION_UPDATE.md` - Detailed production update documentation

## Frontend Architecture

### Component Organization
- **Admin Components** (`frontend/src/components/admin/`):
  - `SystemOverview.tsx` - Comprehensive system statistics and health monitoring
  - `ApiKeyManagement.tsx` - API key management with security features
  - `NodeManagement.tsx` - Node lifecycle and configuration management
  - `UserManagement.tsx` - User account and role management
- **Map Components** (`frontend/src/components/map/`): Interactive world map with real-time node status
- **UI Components** (`frontend/src/components/ui/`): Reusable shadcn/ui components

### Admin Page Structure
The admin interface uses a tabbed layout with clear separation of concerns:
- **System Overview**: Real-time system statistics, node health, and diagnostic metrics
- **Statistics**: Visitor analytics and activity logs
- **System Configuration**: Application settings and parameters
- **Node Management**: Monitoring node deployment and management
- **User Management**: User accounts and role-based permissions
- **API Keys**: Secure API key management for agent authentication

### State Management
- JWT token management with automatic refresh
- Real-time data updates via WebSocket connections
- Local storage for user preferences and session persistence

## Backend Architecture

### API Controller Structure
- **AuthController**: JWT authentication and session management
- **AdminController**: Administrative operations and system management
- **NodeController**: Node registration, status tracking, and management
- **DiagnosticsProxyController**: Network diagnostic operations proxy
- **SystemConfigController**: System configuration and settings management
- **UpdateController**: Zero-downtime system updates
- **VisitorController**: Usage analytics and visitor tracking

### Authentication & Security
- JWT-based authentication with refresh token rotation
- Role-based access control (ADMIN/OPERATOR/VIEWER)
- API key authentication for agent communication
- Comprehensive input validation and sanitization

## Agent Architecture

The agent system provides distributed network monitoring capabilities:
- **Auto-registration**: Agents automatically register with the backend server
- **Network Diagnostics**: Ping, traceroute, MTR, and speedtest operations
- **System Monitoring**: CPU, memory, disk, and network resource tracking
- **Heartbeat Service**: Regular status updates with configurable intervals
- **Secure Communication**: API key-based authentication with the backend

## Production Deployment Scripts

### One-Click Deployment
```bash
# Interactive production deployment with SSL setup
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/deploy-production.sh | bash
```

### System Management
```bash
# Complete system uninstall with cleanup
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/uninstall.sh | bash

# Force uninstall mode (auto-answer yes to all prompts)
curl -fsSL https://raw.githubusercontent.com/lonelyrower/SsalgTen/main/scripts/uninstall.sh | bash -s -- --force
```

## Development Environment

### Node.js Requirements
- **Minimum**: Node.js 20.0.0+, npm 10.0.0+
- **Recommended**: Node.js 20+ LTS with latest npm

### Hot Reload Development
```bash
# Start all services with hot reload
npm run dev

# Start database only for development
npm run dev:db

# Setup development environment with database migration and seeding
npm run dev:setup
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.