# Installation Guide

This guide will help you install and set up SsalgTen Network Monitor on your system.

## Prerequisites

Before installing SsalgTen, ensure you have the following requirements:

### System Requirements

- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: At least 5GB free disk space
- **Network**: Internet connection for agent communication

### Software Requirements

- **Docker & Docker Compose** (Recommended method)
  - Docker 20.0+
  - Docker Compose 2.0+
- **Node.js** (For manual installation)
  - Node.js 18.0 or higher
  - npm 9.0 or higher
- **Database** (For production)
  - PostgreSQL 12+ (recommended)
  - SQLite (development only)

## Installation Methods

### Method 1: Docker Installation (Recommended)

Docker installation is the easiest way to deploy SsalgTen with all its dependencies.

#### Step 1: Install Docker

**Ubuntu/Debian:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
```

**CentOS/RHEL/Rocky:**
```bash
# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**Windows:**
- Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- Enable WSL2 integration if using WSL2

**macOS:**
- Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)

#### Step 2: Download SsalgTen

```bash
# Clone the repository
git clone https://github.com/yourusername/SsalgTen.git
cd SsalgTen

# Or download and extract the latest release
curl -L https://github.com/yourusername/SsalgTen/archive/main.zip -o ssalgten.zip
unzip ssalgten.zip
cd SsalgTen-main
```

#### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration (important!)
nano .env
```

**Important environment variables to change:**

```bash
# Security - CHANGE THESE IN PRODUCTION
DB_PASSWORD=your_secure_database_password_here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_KEY_SECRET=your-api-key-secret-change-this

# Agent API Keys (generate unique keys for each agent)
AGENT_NYC_API_KEY=change-this-nyc-api-key
AGENT_LONDON_API_KEY=change-this-london-api-key

# Frontend URL (if different from localhost)
VITE_API_BASE_URL=http://your-domain.com:3001/api
```

#### Step 4: Deploy with Docker

**Quick deployment:**
```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run deployment check
./scripts/check-deployment.sh

# Deploy all services
./scripts/deploy.sh deploy
```

**Manual deployment:**
```bash
# Start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

#### Step 5: Verify Installation

Access the application:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001/api/health
- **Agent NYC**: http://localhost:3002/api/health

Default admin credentials:
- **Username**: admin
- **Password**: admin123 (change immediately)

### Method 2: Manual Installation

For development or custom deployments, you can install SsalgTen manually.

#### Step 1: Install Node.js

**Ubuntu/Debian:**
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**CentOS/RHEL/Rocky:**
```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

**Windows/macOS:**
- Download and install from [nodejs.org](https://nodejs.org/)

#### Step 2: Install Database

**PostgreSQL (Production):**

*Ubuntu/Debian:*
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres createdb ssalgten
sudo -u postgres createuser -P ssalgten
# Enter password when prompted

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ssalgten TO ssalgten;"
```

*CentOS/RHEL/Rocky:*
```bash
sudo yum install -y postgresql postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres createdb ssalgten
sudo -u postgres createuser -P ssalgten
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ssalgten TO ssalgten;"
```

#### Step 3: Download and Configure

```bash
# Clone repository
git clone https://github.com/yourusername/SsalgTen.git
cd SsalgTen

# Install dependencies for all services
npm install
cd backend && npm install
cd ../frontend && npm install  
cd ../agent && npm install
cd ..
```

#### Step 4: Configure Environment

**Backend (.env):**
```bash
cd backend
cp .env.example .env
nano .env
```

Configure database connection:
```env
# For PostgreSQL
DATABASE_URL="postgresql://ssalgten:password@localhost:5432/ssalgten"

# For SQLite (development only)
DATABASE_URL="file:./dev.db"

# Security
JWT_SECRET=your-super-secret-jwt-key
API_KEY_SECRET=your-api-key-secret
```

**Frontend (.env):**
```bash
cd ../frontend
cp .env.example .env
nano .env
```

**Agent (.env):**
```bash
cd ../agent
cp .env.example .env
nano .env
```

#### Step 5: Initialize Database

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed initial data
npm run seed
```

#### Step 6: Build and Start Services

**Build all services:**
```bash
cd backend && npm run build
cd ../frontend && npm run build  
cd ../agent && npm run build
```

**Start services:**

*Terminal 1 - Backend:*
```bash
cd backend
npm start
```

*Terminal 2 - Frontend:*
```bash
cd frontend
npm run preview
# or for development
npm run dev
```

*Terminal 3 - Agent:*
```bash
cd agent
npm start
```

## Post-Installation Configuration

### 1. Change Default Credentials

**Important**: Change the default admin password immediately:

1. Login to admin panel: http://localhost/admin
2. Use credentials: admin/admin123
3. Go to Profile → Change Password
4. Set a strong password

### 2. Configure System Settings

Access Admin Panel → System Configuration to configure:

- **System Settings**: Name, timezone, maintenance mode
- **Monitoring**: Heartbeat intervals, timeouts
- **Security**: JWT expiration, password policies
- **API**: Rate limiting, CORS settings
- **Notifications**: Alert thresholds

### 3. Add Network Nodes

1. Go to Admin Panel → Node Management
2. Click "Add Node"
3. Configure node details:
   - Name and location
   - Provider information
   - Geographic coordinates
   - Agent API key

### 4. Deploy Agents

For each node, deploy an agent:

```bash
# Copy agent files to target server
scp -r agent/ user@target-server:/opt/ssalgten-agent/

# SSH to target server
ssh user@target-server

# Configure agent
cd /opt/ssalgten-agent
cp .env.example .env
nano .env

# Set agent configuration
AGENT_ID=unique-agent-id
MASTER_URL=http://your-master-server:3001
AGENT_API_KEY=your-secure-api-key
NODE_NAME="Server Location"
NODE_COUNTRY="Country"
NODE_CITY="City"

# Install dependencies and start
npm install
npm run build
npm start

# Or use systemd service
sudo cp ssalgten-agent.service /etc/systemd/system/
sudo systemctl enable ssalgten-agent
sudo systemctl start ssalgten-agent
```

## Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Check what's using the port
sudo lsof -i :3001
sudo lsof -i :80

# Kill process or change port in configuration
```

**2. Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U ssalgten -d ssalgten

# Check firewall settings
sudo ufw status
```

**3. Agent Not Connecting**
```bash
# Check agent logs
cd agent && npm run logs

# Verify master server accessibility
curl http://master-server:3001/api/health

# Check API key configuration
```

**4. Docker Issues**
```bash
# Check Docker status
docker compose ps

# View service logs
docker compose logs backend
docker compose logs frontend

# Restart services
docker compose restart
```

### Performance Optimization

**1. Database Optimization**
```sql
-- For PostgreSQL
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_heartbeat_timestamp ON heartbeat_logs(timestamp);
```

**2. System Resources**
```bash
# Monitor resource usage
docker compose top
htop

# Adjust service limits in docker-compose.yml
```

**3. Network Optimization**
```bash
# Configure firewall for better performance
sudo ufw allow 80
sudo ufw allow 3001
sudo ufw allow 3002
```

## Security Hardening

### 1. Database Security
- Use strong database passwords
- Enable SSL connections
- Restrict database access to localhost only
- Regular backups

### 2. API Security
- Change all default API keys
- Enable rate limiting
- Use HTTPS in production
- Regular security updates

### 3. System Security
- Keep system packages updated
- Use firewall to restrict access
- Monitor logs for suspicious activity
- Regular security audits

## Next Steps

After successful installation:

1. **[Configuration Guide](configuration.md)** - Detailed configuration options
2. **[Agent Setup Guide](agent-setup.md)** - Deploy agents to your servers  
3. **[API Documentation](api.md)** - Integrate with your systems
4. **[Troubleshooting Guide](troubleshooting.md)** - Common issues and solutions

## Support

If you encounter issues during installation:

- Check the [Troubleshooting Guide](troubleshooting.md)
- Review system logs and error messages
- Create an issue on GitHub with detailed information
- Join our community discussions for help
