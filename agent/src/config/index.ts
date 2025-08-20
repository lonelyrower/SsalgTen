import dotenv from 'dotenv';
import os from 'os';
import { AgentConfig } from '../types';

dotenv.config();

// 生成简单的 Agent ID (不依赖 uuid 包)
const generateAgentId = (): string => {
  const hostname = os.hostname();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `agent-${hostname}-${timestamp}-${random}`;
};

export const config: AgentConfig = {
  id: process.env.AGENT_ID || generateAgentId(),
  name: process.env.NODE_NAME || 'Development Node',
  location: {
    country: process.env.NODE_COUNTRY || 'Unknown',
    city: process.env.NODE_CITY || 'Unknown',
    latitude: parseFloat(process.env.NODE_LATITUDE || '0'),
    longitude: parseFloat(process.env.NODE_LONGITUDE || '0'),
  },
  provider: process.env.NODE_PROVIDER || 'Unknown Provider',
  masterUrl: process.env.MASTER_URL || 'http://localhost:3001',
  apiKey: process.env.AGENT_API_KEY || 'default-api-key',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
};

export const serverConfig = {
  port: parseInt(process.env.PORT || '3002'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxConcurrentTests: parseInt(process.env.MAX_CONCURRENT_TESTS || '5'),
};

export const networkConfig = {
  pingCount: parseInt(process.env.PING_COUNT || '4'),
  tracerouteMaxHops: parseInt(process.env.TRACEROUTE_MAX_HOPS || '30'),
  mtrCount: parseInt(process.env.MTR_COUNT || '10'),
  speedtestServerId: process.env.SPEEDTEST_SERVER_ID || 'auto',
};

export const securityConfig = {
  allowedTargets: process.env.ALLOWED_TARGETS?.split(',') || ['*'],
  blockedTargets: process.env.BLOCKED_TARGETS?.split(',') || [
    '127.0.0.1',
    'localhost',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ],
};