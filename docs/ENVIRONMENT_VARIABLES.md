# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in the SsalgTen system.

## 🔧 Server Configuration

### `NODE_ENV`
- **Description**: Application environment mode
- **Type**: String
- **Default**: `development`
- **Valid Values**: `development`, `production`, `test`
- **Example**: `NODE_ENV=production`

### `PORT`
- **Description**: Backend server port
- **Type**: Number  
- **Default**: `3001`
- **Example**: `PORT=3001`

### `HOST`
- **Description**: Backend server bind address
- **Type**: String
- **Default**: `0.0.0.0`
- **Example**: `HOST=127.0.0.1`

## 🗄️ Database Configuration

### `DATABASE_URL`
- **Description**: PostgreSQL connection string
- **Type**: String
- **Default**: `postgresql://ssalgten:ssalgten_password@localhost:5432/ssalgten`
- **Example**: `DATABASE_URL=postgresql://user:pass@localhost:5432/dbname`

### `POSTGRES_USER`
- **Description**: PostgreSQL username
- **Type**: String
- **Default**: `ssalgten`
- **Example**: `POSTGRES_USER=myuser`

### `POSTGRES_PASSWORD`
- **Description**: PostgreSQL password
- **Type**: String
- **Default**: `ssalgten_password`
- **Example**: `POSTGRES_PASSWORD=mypassword`

### `POSTGRES_DB`
- **Description**: PostgreSQL database name
- **Type**: String
- **Default**: `ssalgten`
- **Example**: `POSTGRES_DB=mydatabase`

### `POSTGRES_HOST`
- **Description**: PostgreSQL server hostname
- **Type**: String
- **Default**: `localhost`
- **Example**: `POSTGRES_HOST=db.example.com`

### `POSTGRES_PORT`
- **Description**: PostgreSQL server port
- **Type**: Number
- **Default**: `5432`
- **Example**: `POSTGRES_PORT=5432`

## 🔄 Redis Configuration

### `REDIS_URL`
- **Description**: Redis connection string (overrides individual settings)
- **Type**: String
- **Default**: None
- **Example**: `REDIS_URL=redis://user:pass@localhost:6379`

### `REDIS_HOST`
- **Description**: Redis server hostname
- **Type**: String
- **Default**: `localhost`
- **Example**: `REDIS_HOST=cache.example.com`

### `REDIS_PORT`
- **Description**: Redis server port
- **Type**: Number
- **Default**: `6379`
- **Example**: `REDIS_PORT=6379`

### `REDIS_PASSWORD`
- **Description**: Redis authentication password
- **Type**: String
- **Default**: None
- **Example**: `REDIS_PASSWORD=myredispass`

## 🔐 Authentication & Security

### `JWT_SECRET`
- **Description**: JWT signing secret key (REQUIRED)
- **Type**: String
- **Default**: None
- **Minimum Length**: 32 characters
- **Example**: `JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long`

### `JWT_EXPIRES_IN`
- **Description**: JWT token expiration time
- **Type**: String
- **Default**: `7d`
- **Valid Formats**: `60s`, `5m`, `2h`, `1d`, `7d`, etc.
- **Example**: `JWT_EXPIRES_IN=24h`

### `REFRESH_TOKEN_EXPIRES_IN`
- **Description**: Refresh token expiration time
- **Type**: String
- **Default**: `30d`
- **Example**: `REFRESH_TOKEN_EXPIRES_IN=30d`

### `API_KEY_SECRET`
- **Description**: API key generation secret (REQUIRED)
- **Type**: String
- **Default**: None
- **Example**: `API_KEY_SECRET=your-api-key-secret-for-agent-authentication`

### `DEFAULT_AGENT_API_KEY`
- **Description**: Default API key for agent registration
- **Type**: String
- **Default**: None
- **Example**: `DEFAULT_AGENT_API_KEY=default-agent-key-change-this`

## 🌐 CORS Configuration

### `CORS_ORIGIN`
- **Description**: Allowed CORS origins (supports multiple formats)
- **Type**: String
- **Formats**:
  - Single origin: `https://example.com`
  - Multiple origins: `https://example.com,https://api.example.com` (commas/semicolons/pipes supported)
  - Domain-only: `example.com` (auto-expanded to `https://example.com` and `http://example.com`)
  - Wildcards: `*`, `*.example.com`, `https://*.example.com`, `https://*`
- **Dynamic behavior**:
  - If `CORS_ORIGIN` is unset, backend auto-allows in production: HTTPS, localhost/127.0.0.1, and private networks (10.x, 192.168.x, 172.16–31.x); in development: all origins.
  - Unknown origins are not whitelisted but will not cause 500; CORS headers are simply omitted (browser blocks by same-origin policy).
- **Example**: `CORS_ORIGIN=https://myapp.com,https://admin.myapp.com`

### `FRONTEND_URL`
- **Description**: Additional frontend origin to allow (also accepts domain-only)
- **Type**: String
- **Example**: `FRONTEND_URL=https://st.example.com`

### `DOMAIN`
- **Description**: Domain name of your deployment; used as an additional allowed origin when present (domain-only accepted)
- **Type**: String
- **Example**: `DOMAIN=st.example.com`

## 🤖 Agent Configuration

### `AGENT_HEARTBEAT_INTERVAL`
- **Description**: Agent heartbeat interval in milliseconds
- **Type**: Number
- **Default**: `30000` (30 seconds)
- **Range**: 10000 - 300000 (10 seconds to 5 minutes)
- **Example**: `AGENT_HEARTBEAT_INTERVAL=30000`

### `AGENT_TIMEOUT`
- **Description**: Agent request timeout in milliseconds
- **Type**: Number
- **Default**: `10000` (10 seconds)
- **Example**: `AGENT_TIMEOUT=15000`

### `AGENT_OFFLINE_THRESHOLD`
- **Description**: Time in milliseconds before agent is considered offline
- **Type**: Number
- **Default**: `90000` (90 seconds / 3 missed heartbeats)
- **Example**: `AGENT_OFFLINE_THRESHOLD=120000`

### `AGENT_REQUIRE_SIGNATURE`
- **Description**: Require signature validation for agent requests
- **Type**: Boolean
- **Default**: `false`
- **Valid Values**: `true`, `false`, `1`, `0`
- **Example**: `AGENT_REQUIRE_SIGNATURE=true`

## 🚦 Rate Limiting

### `RATE_LIMIT_WINDOW_MS`
- **Description**: Rate limit window in milliseconds
- **Type**: Number
- **Default**: `900000` (15 minutes)
- **Example**: `RATE_LIMIT_WINDOW_MS=600000`

### `RATE_LIMIT_MAX_REQUESTS`
- **Description**: Maximum requests per window
- **Type**: Number
- **Default**: `100`
- **Example**: `RATE_LIMIT_MAX_REQUESTS=200`

## 📝 Logging Configuration

### `LOG_LEVEL`
- **Description**: Application log level
- **Type**: String
- **Default**: `info`
- **Valid Values**: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`
- **Example**: `LOG_LEVEL=debug`

### `ENABLE_MORGAN`
- **Description**: Enable HTTP request logging
- **Type**: Boolean
- **Default**: `false`
- **Example**: `ENABLE_MORGAN=true`

## 🌐 Network Diagnostic Defaults

### `DEFAULT_PING_COUNT`
- **Description**: Default number of ping packets
- **Type**: Number
- **Default**: `4`
- **Range**: 1 - 20
- **Example**: `DEFAULT_PING_COUNT=8`

### `DEFAULT_TRACEROUTE_MAX_HOPS`
- **Description**: Maximum hops for traceroute
- **Type**: Number
- **Default**: `30`
- **Range**: 5 - 64
- **Example**: `DEFAULT_TRACEROUTE_MAX_HOPS=25`

### `MTR_COUNT`
- **Description**: Number of MTR probe packets
- **Type**: Number
- **Default**: `10`
- **Example**: `MTR_COUNT=20`

### `SPEEDTEST_SERVER_ID`
- **Description**: Speedtest server ID preference
- **Type**: String
- **Default**: `auto`
- **Example**: `SPEEDTEST_SERVER_ID=12345`

## ⚙️ System Configuration

### `TRUST_PROXY`
- **Description**: Trust proxy headers (for reverse proxy setups)
- **Type**: Boolean
- **Default**: `true`
- **Example**: `TRUST_PROXY=false`

### `ENABLE_SYSTEM_METRICS`
- **Description**: Enable system metrics collection
- **Type**: Boolean
- **Default**: `false`
- **Example**: `ENABLE_SYSTEM_METRICS=true`

### `HEALTH_CHECK_INTERVAL`
- **Description**: Health check interval in milliseconds
- **Type**: Number
- **Default**: `30000` (30 seconds)
- **Example**: `HEALTH_CHECK_INTERVAL=60000`

## 🔌 WebSocket Configuration

### `SOCKET_PING_TIMEOUT`
- **Description**: WebSocket ping timeout in milliseconds
- **Type**: Number
- **Default**: `60000` (60 seconds)
- **Example**: `SOCKET_PING_TIMEOUT=45000`

### `SOCKET_PING_INTERVAL`
- **Description**: WebSocket ping interval in milliseconds
- **Type**: Number
- **Default**: `25000` (25 seconds)
- **Example**: `SOCKET_PING_INTERVAL=30000`

## 💾 Cache Configuration

### `CACHE_TTL`
- **Description**: Default cache TTL in milliseconds
- **Type**: Number
- **Default**: `300000` (5 minutes)
- **Example**: `CACHE_TTL=600000`

## 📋 Environment File Examples

### Development (`.env`)
```bash
# Development Configuration
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://ssalgten:ssalgten_password@localhost:5432/ssalgten

# Security
JWT_SECRET=your-development-jwt-secret-change-this-in-production
API_KEY_SECRET=your-development-api-secret

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug
ENABLE_MORGAN=true

# Agent Configuration
AGENT_HEARTBEAT_INTERVAL=30000
AGENT_REQUIRE_SIGNATURE=false
```

### Production (`.env.production`)
```bash
# Production Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:strongpassword@db:5432/ssalgten

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secure-production-jwt-secret-minimum-32-characters
API_KEY_SECRET=your-super-secure-production-api-secret

# CORS
CORS_ORIGIN=https://yourdomain.com,https://api.yourdomain.com

# Logging
LOG_LEVEL=info
ENABLE_MORGAN=false

# Agent Configuration
AGENT_HEARTBEAT_INTERVAL=30000
AGENT_REQUIRE_SIGNATURE=true
AGENT_OFFLINE_THRESHOLD=90000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# System
TRUST_PROXY=true
ENABLE_SYSTEM_METRICS=true
```

## 🔍 Validation

The system validates environment variables on startup and will throw errors if required variables are missing or invalid:

### Required Variables
- `JWT_SECRET`: Must be provided and non-empty
- `API_KEY_SECRET`: Must be provided and non-empty

### Automatic Validation
- Boolean values accept: `true/false`, `1/0`
- Number values are parsed and validated for range where applicable
- String values are trimmed and validated for format where applicable

## 🚨 Security Notes

1. **Never commit real secrets to version control**
2. **Use strong, unique secrets for production**
3. **Regularly rotate JWT and API secrets**
4. **Use environment-specific configuration files**
5. **Validate CORS origins in production**
6. **Enable agent signature validation in production**

## 🛠️ Troubleshooting

### Common Issues

**Missing JWT_SECRET**
```
Error: Missing required environment variables: JWT_SECRET
```
Solution: Set a strong JWT_SECRET in your environment

**Database Connection Failed**
```
Error: Connection to database failed
```
Solution: Verify DATABASE_URL and database server availability

**CORS Issues**
```
Error: Origin not allowed by CORS policy
```
Solution: Check CORS_ORIGIN setting matches your frontend domain

**Agent Connection Issues**
```
Agent heartbeat timeout
```
Solution: Verify AGENT_HEARTBEAT_INTERVAL and network connectivity
