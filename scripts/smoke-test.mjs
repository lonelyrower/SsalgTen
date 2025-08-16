#!/usr/bin/env node
// Simple smoke test: create a temp agent id, register, send heartbeat, fetch node + heartbeat
import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

let BASE = process.env.BASE_URL || 'http://localhost:3001/api/';
if (!BASE.endsWith('/')) BASE += '/';
let backendProcess = null;

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
  // Relative path appended to BASE (which ends with /api/)
  const res = await request('GET', 'health');
      if (res.status === 200) return true;
    } catch {/* ignore */}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function request(method, path, body) {
  // Normalize path: remove any leading slash so it appends to BASE (/api/)
  if (path.startsWith('/')) path = path.slice(1);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null }); }
        catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Ensure backend running
  const reachable = await waitForHealth(2000);
  if (!reachable) {
    console.log('Backend not reachable, starting local instance...');
    backendProcess = spawn(process.execPath, ['backend/dist/server.js'], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, NODE_ENV: 'development' }
    });
    const ok = await waitForHealth(15000);
    if (!ok) {
      console.error('Backend failed to start within timeout');
      backendProcess.kill('SIGINT');
      process.exit(10);
    }
  }
  const agentId = `smoke-${Date.now().toString(36)}`;
  console.log('Agent ID:', agentId);
  const registerResp = await request('POST', '/agent/register', {
    agentId,
    nodeInfo: {
      name: 'Smoke Test Node', country: 'Testland', city: 'Test City', latitude: 0, longitude: 0, provider: 'Test' },
    systemInfo: { platform: 'linux', version: '0.0.0', hostname: 'smoke', uptime: 1 }
  });
  console.log('Register:', registerResp.status, registerResp.body?.success);
  if (!registerResp.body?.data?.nodeId) {
    console.error('Registration failed');
    process.exit(1);
  }
  const nodeId = registerResp.body.data.nodeId;
  const heartbeatResp = await request('POST', `/agent/${agentId}/heartbeat`, { status: 'healthy', uptime: 2, systemInfo: { cpu: { usage: 10 }, memory: { usage: 20 }, disk: { usage: 30 }, network: [], processes: {}, services: {}, virtualization: {}, loadAverage: [0,0,0] } });
  console.log('Heartbeat:', heartbeatResp.status, heartbeatResp.body?.success);
  const fetchedNode = await request('GET', `/nodes/${nodeId}`, null);
  console.log('Fetch Node:', fetchedNode.status, !!fetchedNode.body?.data);
  const heartbeatData = await request('GET', `/nodes/${nodeId}/heartbeat`, null);
  console.log('Fetch Heartbeat:', heartbeatData.status, heartbeatData.body?.data?.status);
  if (heartbeatData.body?.data?.status !== 'healthy') {
    console.error('Heartbeat mismatch');
    process.exit(2);
  }
  console.log('Smoke test passed');
  if (backendProcess) {
    backendProcess.kill('SIGINT');
  }
})();
