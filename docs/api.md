# API Documentation

SsalgTen provides comprehensive REST APIs for managing nodes, users, system configuration, and network diagnostics.

## Base URLs

- **Backend API**: `http://localhost:3001/api`
- **Agent API**: `http://localhost:3002/api`

## Authentication

Most API endpoints require authentication using JWT tokens.

### Getting a Token

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "username": "admin",
      "role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d"
  },
  "message": "Login successful"
}
```

### Using Tokens

Include the token in the Authorization header:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## API Response Format

All APIs follow a consistent response format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description"
}
```

## Backend API Endpoints

### Authentication APIs

#### Login
```bash
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

#### Get Profile
```bash
GET /api/auth/profile
Authorization: Bearer <token>
```

#### Change Password
```bash
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "string",
  "newPassword": "string"
}
```

#### Refresh Token
```bash
POST /api/auth/refresh
Authorization: Bearer <token>
```

### Node Management APIs

#### Get All Nodes
```bash
GET /api/nodes
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "node-id",
      "name": "New York Node",
      "country": "United States",
      "city": "New York",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "provider": "DigitalOcean",
      "status": "ONLINE",
      "lastSeen": "2025-01-01T10:00:00Z",
      "ipv4": "192.168.1.10"
    }
  ]
}
```

#### Get Node by ID
```bash
GET /api/nodes/:id
```

#### Get Node Statistics
```bash
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNodes": 6,
    "onlineNodes": 4,
    "offlineNodes": 1,
    "unknownNodes": 1,
    "totalCountries": 5,
    "totalProviders": 4
  }
}
```

### Admin APIs (Require Admin Role)

#### User Management

**Get All Users:**
```bash
GET /api/admin/users
Authorization: Bearer <admin-token>
```

**Create User:**
```bash
POST /api/admin/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "name": "New User",
  "password": "password123",
  "role": "OPERATOR",
  "active": true
}
```

**Update User:**
```bash
PUT /api/admin/users/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "VIEWER",
  "active": false
}
```

**Delete User:**
```bash
DELETE /api/admin/users/:id
Authorization: Bearer <admin-token>
```

#### Node Management

**Create Node:**
```bash
POST /api/admin/nodes
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Tokyo Node",
  "country": "Japan",
  "city": "Tokyo",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "provider": "AWS",
  "datacenter": "ap-northeast-1",
  "description": "Asia-Pacific monitoring node"
}
```

**Update Node:**
```bash
PUT /api/admin/nodes/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Updated Node Name",
  "status": "MAINTENANCE",
  "description": "Updated description"
}
```

**Delete Node:**
```bash
DELETE /api/admin/nodes/:id
Authorization: Bearer <admin-token>
```

#### System Configuration

**Get All Configurations:**
```bash
GET /api/admin/configs
Authorization: Bearer <admin-token>

# Filter by category
GET /api/admin/configs?category=system
```

**Get Configuration by Key:**
```bash
GET /api/admin/configs/:key
Authorization: Bearer <admin-token>
```

**Update Configuration:**
```bash
PUT /api/admin/configs/:key
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "value": "new-value",
  "description": "Updated description"
}
```

**Batch Update Configurations:**
```bash
POST /api/admin/configs/batch
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "configs": [
    {
      "key": "system.name",
      "value": "My Network Monitor",
      "description": "System display name"
    },
    {
      "key": "monitoring.heartbeat_interval",
      "value": 25000,
      "description": "Heartbeat interval in ms"
    }
  ]
}
```

**Reset to Defaults:**
```bash
POST /api/admin/configs/reset
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "category": "system"  // Optional: reset specific category
}
```

**Get Configuration Categories:**
```bash
GET /api/admin/configs/categories
Authorization: Bearer <admin-token>
```

#### System Statistics

**Get System Statistics:**
```bash
GET /api/admin/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": {
      "total": 6,
      "online": 4,
      "offline": 1,
      "unknown": 1
    },
    "users": {
      "total": 3,
      "admins": 1,
      "operators": 1,
      "viewers": 1
    },
    "diagnostics": {
      "totalRecords": 1250
    },
    "heartbeats": {
      "totalLogs": 8960
    },
    "recentActivity": [
      {
        "nodeId": "node-id",
        "nodeName": "New York Node",
        "location": "New York, United States",
        "status": "healthy",
        "timestamp": "2025-01-01T10:00:00Z"
      }
    ]
  }
}
```

### Agent Communication APIs

#### Agent Registration
```bash
POST /api/agent/register
X-API-Key: <agent-api-key>
Content-Type: application/json

{
  "agentId": "agent-unique-id",
  "systemInfo": {
    "hostname": "server.example.com",
    "platform": "linux",
    "arch": "x64",
    "osType": "Linux",
    "osVersion": "Ubuntu 20.04"
  },
  "location": {
    "country": "United States",
    "city": "New York",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "provider": "DigitalOcean"
}
```

#### Agent Heartbeat
```bash
POST /api/agent/:agentId/heartbeat
X-API-Key: <agent-api-key>
Content-Type: application/json

{
  "status": "healthy",
  "uptime": 123456,
  "systemMetrics": {
    "cpuUsage": 15.5,
    "memoryUsage": 45.2,
    "diskUsage": 78.9,
    "networkRx": 1024000,
    "networkTx": 512000
  }
}
```

#### Report Diagnostic Result
```bash
POST /api/agent/:agentId/diagnostic
X-API-Key: <agent-api-key>
Content-Type: application/json

{
  "type": "ping",
  "target": "google.com",
  "result": {
    "success": true,
    "data": {
      "host": "google.com",
      "alive": true,
      "avg": 25.5,
      "min": 22.1,
      "max": 30.2,
      "packetLoss": 0
    }
  },
  "timestamp": "2025-01-01T10:00:00Z"
}
```

## Agent API Endpoints

These endpoints are exposed by each agent for direct diagnostic requests.

### Health Check
```bash
GET /api/health
```

### Agent Information
```bash
GET /api/info
```

### Network Diagnostics

#### Ping Test
```bash
GET /api/ping/:target
```

**Example:**
```bash
GET /api/ping/google.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "host": "google.com",
    "alive": true,
    "avg": 25.5,
    "min": 22.1,
    "max": 30.2,
    "packetLoss": 0
  },
  "agent": {
    "id": "agent-nyc",
    "name": "New York Node",
    "location": "New York, United States"
  },
  "timestamp": "2025-01-01T10:00:00Z"
}
```

#### Traceroute Test
```bash
GET /api/traceroute/:target
```

**Response:**
```json
{
  "success": true,
  "data": {
    "target": "google.com",
    "totalHops": 12,
    "hops": [
      {
        "hop": 1,
        "ip": "192.168.1.1",
        "hostname": "router.local",
        "rtt1": 1.2,
        "rtt2": 1.5,
        "rtt3": 1.3
      }
    ]
  }
}
```

#### MTR Test
```bash
GET /api/mtr/:target
```

#### Speed Test
```bash
GET /api/speedtest
```

**Response:**
```json
{
  "success": true,
  "data": {
    "download": 95.5,
    "upload": 45.2,
    "ping": 12.5,
    "server": "Speedtest.net Server (New York)"
  }
}
```

#### Connectivity Test
```bash
GET /api/connectivity
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connectivity": {
      "google.com": true,
      "cloudflare.com": true,
      "github.com": true,
      "stackoverflow.com": false
    }
  }
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

## Rate Limiting

APIs are rate-limited to prevent abuse:

- **Public APIs**: 100 requests per 15 minutes per IP
- **Authenticated APIs**: 1000 requests per 15 minutes per user
- **Agent APIs**: 10000 requests per 15 minutes per agent

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

## Webhooks (Coming Soon)

SsalgTen will support webhooks for real-time notifications:

- Node status changes
- Diagnostic failures
- System alerts
- User activities

## SDK and Libraries

Official SDKs will be available for:

- **JavaScript/TypeScript** - npm package
- **Python** - PyPI package
- **Go** - Go module
- **PHP** - Composer package

## Example Usage

### JavaScript/Node.js

```javascript
const axios = require('axios');

class SsalgTenAPI {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getNodes() {
    const response = await this.client.get('/nodes');
    return response.data;
  }

  async createNode(nodeData) {
    const response = await this.client.post('/admin/nodes', nodeData);
    return response.data;
  }

  async runDiagnostic(agentUrl, type, target) {
    const response = await axios.get(`${agentUrl}/api/${type}/${target}`);
    return response.data;
  }
}

// Usage
const api = new SsalgTenAPI('http://localhost:3001/api', 'your-jwt-token');

async function example() {
  // Get all nodes
  const nodes = await api.getNodes();
  console.log('Nodes:', nodes);

  // Create a new node
  const newNode = await api.createNode({
    name: 'London Node',
    country: 'United Kingdom',
    city: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    provider: 'AWS'
  });

  // Run diagnostic test
  const pingResult = await api.runDiagnostic(
    'http://localhost:3002',
    'ping',
    'google.com'
  );
  console.log('Ping result:', pingResult);
}
```

### Python

```python
import requests

class SsalgTenAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_nodes(self):
        response = requests.get(f'{self.base_url}/nodes', headers=self.headers)
        return response.json()
    
    def create_node(self, node_data):
        response = requests.post(
            f'{self.base_url}/admin/nodes',
            json=node_data,
            headers=self.headers
        )
        return response.json()
    
    def run_diagnostic(self, agent_url, diagnostic_type, target):
        response = requests.get(f'{agent_url}/api/{diagnostic_type}/{target}')
        return response.json()

# Usage
api = SsalgTenAPI('http://localhost:3001/api', 'your-jwt-token')

# Get all nodes
nodes = api.get_nodes()
print('Nodes:', nodes)

# Run ping test
ping_result = api.run_diagnostic('http://localhost:3002', 'ping', 'google.com')
print('Ping result:', ping_result)
```

## Support

For API support and questions:

- **Documentation**: Check this API reference
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Email**: api-support@ssalgten.com

## Changelog

### v1.0.0
- Initial API release
- Full CRUD operations for nodes and users
- Complete system configuration management
- Network diagnostic APIs
- JWT authentication system