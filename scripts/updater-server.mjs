#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8765;
const TOKEN = process.env.UPDATER_TOKEN || '';
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const UPDATE_SCRIPT = process.env.UPDATE_SCRIPT || join(WORKSPACE, 'scripts', 'update-frontend.sh');
const LOG_DIR = process.env.UPDATE_LOG_DIR || join(WORKSPACE, '.update', 'logs');

mkdirSync(LOG_DIR, { recursive: true });

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

function startUpdate(opts = {}) {
  const id = Date.now().toString();
  const logfile = join(LOG_DIR, `${id}.log`);
  const out = createWriteStream(logfile);

  // Pass through important envs; allow forceAgent toggle
  const env = { ...process.env };
  if (opts.PROJECT_PORT) env.PROJECT_PORT = String(opts.PROJECT_PORT);
  if (opts.NODE_PORT) env.NODE_PORT = String(opts.NODE_PORT);
  if (opts.BACKEND_PORT) env.BACKEND_PORT = String(opts.BACKEND_PORT);
  if (opts.DB_PORT) env.DB_PORT = String(opts.DB_PORT);
  if (opts.forceAgent) env.FORCE_ENABLE_AGENT = 'true';

  const child = spawn('bash', [UPDATE_SCRIPT], {
    cwd: WORKSPACE,
    env,
  });

  child.stdout.pipe(out);
  child.stderr.pipe(out);

  child.on('close', (code) => {
    out.end(`\n---\nUpdate finished with code ${code}\n`);
  });

  return { id, logfile };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/update') {
    if (TOKEN && req.headers['x-updater-token'] !== TOKEN) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const body = await parseBody(req);
    const prefer = String(req.headers['prefer'] || '');
    const asyncMode = prefer.includes('respond-async') || !!body.async;
    const job = startUpdate(body || {});
    if (asyncMode) {
      return send(res, 202, { started: true, job });
    }
    // Synchronous mode: stream logs then close
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write(`# Update job ${job.id} started...\n`);
    res.write(`# Logs: ${job.logfile}\n`);
    res.write(`# This endpoint is designed for async usage; logs are written to file.\n`);
    return res.end();
  }

  return send(res, 404, { error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Updater listening on :${PORT}`);
});

