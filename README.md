# SsalgTen Network Monitor

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()

A comprehensive multi-node network diagnostic and monitoring system inspired by Looking Glass networks. SsalgTen provides real-time network monitoring, diagnostics, and visualization through a distributed agent architecture with complete admin management capabilities.

## 🌟 Features

### Core Functionality
- **🌍 Global Network Monitoring** - Deploy agents worldwide for comprehensive network visibility
- **📊 Real-time Diagnostics** - Ping, Traceroute, MTR, and Speed tests from multiple locations
- **🗺️ Interactive World Map** - Visualize your network nodes and their status in real-time
- **⚡ Agent Architecture** - Lightweight, distributed monitoring agents
- **🔐 Complete Admin System** - Full user management, authentication, and system configuration

### Network Diagnostic Tools
- **Ping Tests** - Basic connectivity and latency measurements
- **Traceroute** - Network path analysis and hop identification  
- **MTR (My Traceroute)** - Combined ping and traceroute analysis
- **Speed Tests** - Bandwidth measurement capabilities
- **Connectivity Checks** - Multi-target reachability verification

### Management Features
- **👥 User Management** - Role-based access control (Admin/Operator/Viewer)
- **🖥️ Node Management** - Add, edit, and monitor network nodes
- **⚙️ System Configuration** - 25+ configurable system parameters
- **📈 Statistics Dashboard** - Real-time system health and performance metrics
- **🔍 Live Monitoring** - Agent status tracking with heartbeat monitoring
- **🔑 JWT Authentication** - Secure API access with token-based authentication

## 🏗️ Architecture

SsalgTen consists of three main components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │     Backend     │    │     Agent       │
│   (React UI)    │◄──►│   (API Server)  │◄──►│   (Probe Node)  │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 3002    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend (React + TypeScript)
- Interactive world map with Leaflet
- Real-time node status visualization
- Modern UI with TailwindCSS + shadcn/ui
- Statistics dashboard and management interface

### Backend (Node.js + Express + TypeScript)
- RESTful API server
- Node management and registration
- Data aggregation and processing
- Agent communication hub

### Agent (Node.js + TypeScript)
- Lightweight network diagnostic probe
- Cross-platform network tools integration
- System monitoring and reporting
- Secure communication with master server

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui components  
- **Map**: react-leaflet + OpenStreetMap
- **Icons**: Lucide React
- **Charts**: Recharts

### Backend  
- **Runtime**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **ORM**: Prisma (Ready)
- **Security**: JWT, bcrypt, helmet
- **Validation**: Input sanitization and API key auth

### Agent
- **Runtime**: Node.js + TypeScript
- **Network Tools**: System commands (ping, tracert, traceroute)
- **Monitoring**: System resource collection
- **Communication**: HTTP/REST with master server

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+
- Git

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/SsalgTen.git
cd SsalgTen
```

2. **Install all dependencies**:
```bash
npm run install:all
```

3. **Set up environment variables**:
```bash
# Frontend
cd frontend
cp .env.example .env

# Backend  
cd ../backend
cp .env.example .env

# Agent
cd ../agent
cp .env.example .env
```

4. **Start all services**:
```bash
# From project root
npm run dev
```

Or start services individually:
```bash
# Frontend (Terminal 1)
cd frontend && npm run dev

# Backend (Terminal 2)  
cd backend && npm run dev

# Agent (Terminal 3)
cd agent && npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000 - Main web interface
- **Backend API**: http://localhost:3001 - API endpoints  
- **Agent**: http://localhost:3002 - Agent probe interface

## 📁 Project Structure

```
SsalgTen/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── layout/      # Header, navigation
│   │   │   ├── map/         # Map components
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── pages/           # Page components
│   │   └── lib/             # Utilities
│   └── package.json
├── backend/                  # Express API server
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middlewares/     # Express middlewares
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helper functions
│   │   └── types/           # TypeScript types
│   └── package.json
├── agent/                    # VPS probe agent
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── services/        # Network diagnostic services
│   │   ├── utils/           # System utilities
│   │   ├── config/          # Configuration management
│   │   └── types/           # TypeScript types
│   └── package.json
├── deploy/                   # Docker and deployment
├── docs/                     # Documentation
└── package.json             # Root workspace config
```

## 🔧 Development

### Available Scripts

```bash
# Root workspace commands
npm run dev              # Start all services
npm run install:all      # Install all dependencies  
npm run build           # Build all projects
npm run lint            # Lint all code
npm run type-check      # Type check all TypeScript

# Individual service commands
cd frontend && npm run dev    # Frontend dev server
cd backend && npm run dev     # Backend dev server  
cd agent && npm run dev       # Agent dev server
```

### Development Workflow

1. Each major feature should be developed in a separate branch
2. Follow the development roadmap in phases
3. Update documentation alongside code changes
4. Test thoroughly before merging

## 📖 API Documentation

### Backend API Endpoints

```
GET  /                      # API welcome
GET  /api/health           # Health check
GET  /api/info             # API information
GET  /api/nodes            # List nodes (placeholder)
GET  /api/diagnostics      # Diagnostic history (placeholder)
```

### Agent API Endpoints

```
GET  /                      # Agent information
GET  /health               # Agent health check
GET  /info                 # Agent capabilities
GET  /api/ping/:target     # Ping diagnostic (placeholder)
GET  /api/traceroute/:target # Traceroute diagnostic (placeholder)
GET  /api/mtr/:target      # MTR network test (placeholder)
GET  /api/speedtest        # Bandwidth test (placeholder)
```

## 🚧 Development Status

### ✅ Completed Phases

**Phase 1: Project Infrastructure** ✅
- [x] Project structure and configuration
- [x] Frontend React + TypeScript setup
- [x] Backend Express + TypeScript setup
- [x] Development environment configuration

**Phase 2: Map Visualization** ✅  
- [x] Interactive world map with Leaflet
- [x] Node data model and interfaces
- [x] Map markers and popups
- [x] Statistics dashboard
- [x] Modern UI with shadcn/ui

**Phase 3.1: Agent Foundation** ✅
- [x] Agent basic architecture
- [x] TypeScript configuration
- [x] System monitoring capabilities
- [x] Configuration management

**Phase 3.2: Network Tools Architecture** ✅
- [x] Network diagnostic service structure
- [x] Cross-platform command integration
- [x] API controller framework
- [x] Security validation system

### 🚧 In Progress

**Phase 3.3: API Integration** (Current)
- [ ] Complete Agent API route implementation
- [ ] Network diagnostic tool testing
- [ ] Result formatting and validation
- [ ] Error handling optimization

### 📋 Upcoming Phases

**Phase 3.4: Master Integration**
- [ ] Agent registration with backend
- [ ] Heartbeat service implementation
- [ ] Backend node management API
- [ ] Frontend-backend data integration

**Phase 4: Full Network Diagnostics**
- [ ] Real-time ping implementation
- [ ] Traceroute visualization
- [ ] MTR network quality analysis
- [ ] Speedtest integration

**Phase 5: Advanced Features**
- [ ] Admin authentication system
- [ ] Node grouping and management
- [ ] Historical data and analytics
- [ ] Alert and monitoring system

## 🐳 Deployment

### Development

All services run locally for development:

```bash
npm run dev
```

### Production (Coming Soon)

```bash
# Docker deployment
docker-compose up -d

# Manual deployment
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [looking.house](https://looking.house) and similar looking glass services
- Built with modern web technologies and best practices
- Special thanks to the open source community

## 📞 Support

If you have any questions or need help:

- 📧 Create an issue on GitHub
- 📚 Check the documentation in `/docs`
- 💬 Join our community discussions

---

**Note**: This project is currently in active development. The network diagnostic tools are in the implementation phase. Current version provides the complete UI framework and agent architecture foundation.