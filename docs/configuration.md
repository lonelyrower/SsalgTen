# Configuration Reference

This document provides comprehensive information about configuring SsalgTen Network Monitor.

## Configuration Overview

SsalgTen uses multiple configuration methods:

1. **Environment Variables** - Service-level configuration
2. **System Configuration** - Runtime settings managed via admin panel
3. **Database Settings** - Stored configuration in the database
4. **Docker Configuration** - Container-specific settings

## Environment Variables

### Backend Configuration

#### Database Settings
```bash
# Database connection string
DATABASE_URL="postgresql://user:password@host:5432/database"
# or for SQLite
DATABASE_URL="file:./dev.db"
```

#### Server Settings
```bash
NODE_ENV=production                    # Environment: development, production, test
PORT=3001                             # Backend server port
HOST=0.0.0.0                          # Bind address (0.0.0.0 for all interfaces)
```

#### Security Settings
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key       # JWT signing secret (CHANGE IN PRODUCTION)
JWT_EXPIRES_IN=7d                      # Token expiration time (e.g., 1h, 7d, 30d)

# API Security
API_KEY_SECRET=your-api-secret         # Secret for generating API keys
CORS_ORIGIN=http://localhost:3000      # Allowed CORS origins (comma-separated)

# Agent Authentication
DEFAULT_AGENT_API_KEY=default-key      # Default API key for agents
AGENT_HEARTBEAT_INTERVAL=30000         # Agent heartbeat interval (ms)
AGENT_TIMEOUT=10000                    # Agent request timeout (ms)
```

#### Logging Settings
```bash
LOG_LEVEL=info                         # Log level: debug, info, warn, error
ENABLE_MORGAN=true                     # Enable HTTP request logging
```

#### External Services
```bash
SPEEDTEST_SERVER_ID=auto               # Speedtest server ID (auto or specific)
DEFAULT_PING_COUNT=4                   # Default ping packet count
DEFAULT_TRACEROUTE_MAX_HOPS=30         # Default traceroute max hops
```

### Frontend Configuration

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001/api  # Backend API URL
VITE_WS_URL=ws://localhost:3001              # WebSocket URL (future)

# Application Settings
VITE_APP_NAME=SsalgTen Network Monitor       # Application name
VITE_APP_VERSION=1.0.0                       # Application version
VITE_ENABLE_DEBUG=false                      # Enable debug mode

# Map Configuration
VITE_MAP_PROVIDER=openstreetmap              # Map provider: openstreetmap, mapbox
VITE_MAP_API_KEY=                            # Map API key (if required)
VITE_MAP_DEFAULT_ZOOM=2                      # Default map zoom level
VITE_MAP_CLUSTER_DISTANCE=50                 # Marker clustering distance

# UI Settings
VITE_THEME=system                            # Default theme: light, dark, system
VITE_LANGUAGE=en                             # Default language
```

### Agent Configuration

```bash
# Agent Identity
AGENT_ID=unique-agent-identifier             # Unique agent identifier
NODE_NAME=Server Location Name               # Human-readable node name

# Master Server Configuration
MASTER_URL=http://backend:3001               # Master server URL
AGENT_API_KEY=secure-api-key                 # Agent API key for authentication

# Location Information
NODE_COUNTRY=United States                   # Node country
NODE_CITY=New York                           # Node city
NODE_PROVIDER=DigitalOcean                   # Hosting provider
NODE_LATITUDE=40.7128                        # Geographic latitude
NODE_LONGITUDE=-74.0060                      # Geographic longitude

# Network Configuration
PING_COUNT=4                                 # Default ping count
TRACEROUTE_MAX_HOPS=30                       # Max traceroute hops
MTR_COUNT=10                                 # MTR test count
SPEEDTEST_SERVER_ID=auto                     # Speedtest server preference

# System Configuration
HEARTBEAT_INTERVAL=30000                     # Heartbeat interval (ms)
LOG_LEVEL=info                              # Agent log level
MAX_CONCURRENT_TESTS=5                       # Max concurrent diagnostic tests

# Security Configuration
ALLOWED_TARGETS=*                            # Allowed test targets (* for all)
BLOCKED_TARGETS=127.0.0.1,localhost         # Blocked targets (comma-separated)
```

## System Configuration

System configuration is managed through the admin panel and stored in the database. These settings can be modified at runtime without restarting services.

### System Settings

| Key | Default | Description |
|-----|---------|-------------|
| `system.name` | SsalgTen Network Monitor | System display name |
| `system.version` | 1.0.0 | Current system version |
| `system.timezone` | UTC | System timezone |
| `system.maintenance_mode` | false | Enable maintenance mode |

### Monitoring Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `monitoring.heartbeat_interval` | 30000 | Agent heartbeat interval (ms) |
| `monitoring.heartbeat_timeout` | 90000 | Agent heartbeat timeout (ms) |
| `monitoring.max_offline_time` | 300000 | Max offline time before marking node offline |
| `monitoring.cleanup_interval` | 86400000 | Cleanup interval for old records (ms) |
| `monitoring.retention_days` | 30 | Data retention period (days) |

### Diagnostics Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `diagnostics.default_ping_count` | 4 | Default ping packet count |
| `diagnostics.default_traceroute_hops` | 30 | Default traceroute max hops |
| `diagnostics.default_mtr_count` | 10 | Default MTR test count |
| `diagnostics.speedtest_enabled` | true | Enable speedtest functionality |
| `diagnostics.max_concurrent_tests` | 5 | Max concurrent tests per agent |

### Security Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `security.jwt_expires_in` | 7d | JWT token expiration time |
| `security.max_login_attempts` | 5 | Max login attempts before lockout |
| `security.lockout_duration` | 900000 | Account lockout duration (ms) |
| `security.require_strong_passwords` | true | Require strong passwords |

### API Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `api.rate_limit_requests` | 100 | API rate limit requests per window |
| `api.rate_limit_window` | 900000 | API rate limit window (ms) |
| `api.cors_enabled` | true | Enable CORS for API requests |
| `api.log_level` | info | API logging level |

### Notification Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `notifications.email_enabled` | false | Enable email notifications |
| `notifications.webhook_enabled` | false | Enable webhook notifications |
| `notifications.alert_threshold` | 3 | Failures before sending alert |

## Docker Configuration

### Docker Compose Environment Variables

```bash
# Database
DB_PASSWORD=secure_password
DB_PORT=5432

# Redis (Optional)
REDIS_PASSWORD=redis_password
REDIS_PORT=6379

# Service Ports
BACKEND_PORT=3001
FRONTEND_PORT=80
AGENT_NYC_PORT=3002

# Agent Specific
AGENT_NYC_ID=agent-nyc-docker
AGENT_NYC_API_KEY=secure-nyc-key
AGENT_NYC_NAME=New York Node (Docker)
AGENT_NYC_COUNTRY=United States
AGENT_NYC_CITY=New York
```

### Docker Service Configuration

Services can be configured via docker compose (docker-compose.yml):

```yaml
services:
  backend:
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    restart: unless-stopped
    
  database:
    environment:
      POSTGRES_DB: ssalgten
      POSTGRES_USER: ssalgten
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Configuration Management

### Admin Panel Configuration

Access system configuration through:
1. Login to admin panel
2. Navigate to System → Configuration
3. Select category (System, Monitoring, Security, etc.)
4. Modify values as needed
5. Save changes

### Programmatic Configuration

Use the API to manage configuration:

```bash
# Get configuration
GET /api/admin/configs

# Update configuration
PUT /api/admin/configs/system.name
{
  "value": "My Network Monitor",
  "description": "Updated system name"
}

# Batch update
POST /api/admin/configs/batch
{
  "configs": [
    {
      "key": "monitoring.heartbeat_interval",
      "value": 25000
    }
  ]
}
```

### Configuration Validation

System validates configuration values:

- **Type checking** - Ensures correct data types
- **Range validation** - Checks numerical ranges
- **Format validation** - Validates strings and patterns
- **Dependency checking** - Ensures related settings are consistent

## Advanced Configuration

### Database Optimization

**PostgreSQL Configuration:**
```sql
-- Performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Connection settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

SELECT pg_reload_conf();
```

**SQLite Configuration:**
```sql
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA journal_mode = WAL;
```

### Load Balancing Configuration

**Nginx Configuration:**
```nginx
upstream backend {
    server backend-1:3001;
    server backend-2:3001;
    server backend-3:3001;
}

server {
    listen 80;
    
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Monitoring Configuration

**Prometheus Integration:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ssalgten-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    
  - job_name: 'ssalgten-agents'
    static_configs:
      - targets: ['agent-1:3002', 'agent-2:3002']
```

### SSL/TLS Configuration

**Nginx SSL Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://frontend:80;
    }
    
    location /api/ {
        proxy_pass http://backend:3001;
    }
}
```

## Configuration Best Practices

### Security Best Practices

1. **Change Default Secrets**
   - Update all default passwords
   - Generate strong JWT secrets
   - Use unique API keys for each agent

2. **Environment Isolation**
   - Use different configurations for dev/staging/prod
   - Never commit secrets to version control
   - Use environment-specific .env files

3. **Access Control**
   - Limit database access
   - Use firewall rules
   - Enable audit logging

### Performance Best Practices

1. **Database Configuration**
   - Optimize connection pool size
   - Configure appropriate timeouts
   - Use connection pooling

2. **Caching**
   - Enable Redis for session storage
   - Configure appropriate cache TTLs
   - Use CDN for static assets

3. **Monitoring**
   - Set up health checks
   - Monitor resource usage
   - Configure alerting

### Backup and Recovery

1. **Database Backups**
   ```bash
   # PostgreSQL backup
   pg_dump -h localhost -U ssalgten -d ssalgten > backup.sql
   
   # Restore
   psql -h localhost -U ssalgten -d ssalgten < backup.sql
   ```

2. **Configuration Backup**
   ```bash
   # Export system configuration
   curl -H "Authorization: Bearer $TOKEN" \
        http://localhost:3001/api/admin/configs > config-backup.json
   ```

3. **Docker Volume Backup**
   ```bash
   # Backup Docker volumes
   docker run --rm -v ssalgten-postgres-data:/data \
              -v $(pwd):/backup alpine \
              tar czf /backup/postgres-backup.tar.gz /data
   ```

## Troubleshooting Configuration

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database server is running
   - Check firewall and network connectivity

2. **JWT Token Issues**
   - Verify JWT_SECRET is set and consistent
   - Check token expiration settings
   - Ensure system clock synchronization

3. **Agent Connection Problems**
   - Verify MASTER_URL is accessible
   - Check agent API keys
   - Review firewall settings

### Configuration Validation

```bash
# Check backend configuration
npm run config:validate

# Test database connection
npm run db:test

# Validate agent connectivity
npm run agent:test
```

## Configuration Migration

### Version Upgrades

When upgrading SsalgTen:

1. **Backup Current Configuration**
   ```bash
   ./scripts/backup-config.sh
   ```

2. **Review Configuration Changes**
   - Check CHANGELOG.md for config changes
   - Review new configuration options
   - Update environment variables if needed

3. **Apply Database Migrations**
   ```bash
   npx prisma migrate deploy
   ```

4. **Verify Configuration**
   ```bash
   ./scripts/verify-config.sh
   ```

## Support

For configuration support:

- **Documentation**: This configuration reference
- **Issues**: GitHub issues for configuration problems
- **Community**: GitHub Discussions for configuration questions
- **Examples**: Check `examples/` directory for sample configurations
