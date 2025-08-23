#!/usr/bin/env node

// Verify that a node can register and appear online in the master UI by calling backend APIs directly.
// Usage:
//   node scripts/verify-node-online.js --server https://your-domain.com --api-key <system-api-key>
// or with env vars:
//   SERVER=https://your-domain.com API_KEY=xxxx node scripts/verify-node-online.js

const http = require('http');
const https = require('https');
const { URL } = require('url');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--server') out.server = args[++i];
    else if (a === '--api-key') out.apiKey = args[++i];
    else if (a === '--agent-id') out.agentId = args[++i];
  }
  out.server = out.server || process.env.SERVER;
  out.apiKey = out.apiKey || process.env.API_KEY;
  if (!out.server || !out.apiKey) {
    console.error('Missing required --server and --api-key');
    process.exit(1);
  }
  if (!/^https?:\/\//.test(out.server)) {
    console.error('Server must start with http:// or https://');
    process.exit(1);
  }
  return out;
}

function req(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      }
    };
    const client = u.protocol === 'https:' ? https : http;
    const r = client.request(opts, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: chunks });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const { server, apiKey, agentId: providedAgentId } = parseArgs();
  const base = server.replace(/\/$/, '') + '/api';
  const agentId = providedAgentId || `verify-${Date.now().toString(36)}`;
  console.log('Server:', base);
  console.log('Agent ID:', agentId);

  // Register
  const registerPayload = {
    agentId,
    nodeInfo: {
      name: `Verify Node ${new Date().toISOString()}`,
      country: 'China',
      city: 'Beijing',
      latitude: 39.9042,
      longitude: 116.4074,
      provider: 'Verification'
    },
    systemInfo: { platform: 'linux', version: 'v0', hostname: 'verify', uptime: 1 }
  };
  const reg = await req('POST', `${base}/agents/register`, { 'X-API-Key': apiKey }, registerPayload);
  console.log('Register status:', reg.status);
  if (reg.status !== 200 || !reg.body?.success) {
    console.error('Register failed:', reg.body || reg.raw);
    process.exit(2);
  }
  const nodeId = reg.body.data.nodeId;
  console.log('Node ID:', nodeId);

  // Heartbeat
  const hbPayload = {
    status: 'healthy',
    uptime: 123,
    nodeIPs: { ipv4: '203.0.113.20' },
    systemInfo: { cpu: { usage: 10 }, memory: { usage: 20 }, disk: { usage: 30 }, network: [], processes: {}, virtualization: {}, services: {}, loadAverage: [0,0,0] }
  };
  const hb = await req('POST', `${base}/agents/${agentId}/heartbeat`, { 'X-API-Key': apiKey }, hbPayload);
  console.log('Heartbeat status:', hb.status);
  if (hb.status !== 200 || !hb.body?.success) {
    console.error('Heartbeat failed:', hb.body || hb.raw);
    process.exit(3);
  }

  // Fetch node + heartbeat
  const nodeResp = await req('GET', `${base}/nodes/${nodeId}`);
  console.log('Fetch node:', nodeResp.status, !!nodeResp.body?.data);
  const hbResp = await req('GET', `${base}/nodes/${nodeId}/heartbeat`);
  console.log('Fetch heartbeat:', hbResp.status, hbResp.body?.data?.status);

  console.log('\nIf your frontend is open on Nodes page, it should reflect this node within seconds (immediate broadcast added).');
}

main().catch(e => { console.error(e); process.exit(1); });

