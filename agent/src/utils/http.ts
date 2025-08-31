import axios from 'axios';
import https from 'https';
import { config } from '../config';

// Centralized HTTP client for the agent.
// If AGENT_TLS_INSECURE=true|1, disable TLS verification to tolerate
// misconfigured/intermediate-missing cert chains on the master server.
const httpsAgent = config.tlsInsecure
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

export const http = axios.create({
  // Only set when insecure mode is enabled; otherwise default behavior applies.
  httpsAgent,
  // Reasonable default; callers can override per-request.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default http;

