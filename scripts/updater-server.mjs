#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8765;
const TOKEN = process.env.UPDATER_TOKEN || '';
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const UPDATE_SCRIPT = process.env.UPDATE_SCRIPT || join(WORKSPACE, 'scripts', 'update-production.sh');
const LOG_DIR = process.env.UPDATE_LOG_DIR || join(WORKSPACE, '.update', 'logs');
const MAX_BODY_BYTES = process.env.UPDATER_MAX_BODY_BYTES
  ? Number(process.env.UPDATER_MAX_BODY_BYTES)
  : 1024 * 1024; // 1 MiB

mkdirSync(LOG_DIR, { recursive: true });

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length || 0;
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload_too_large'), { statusCode: 413 }));
        try { req.destroy(); } catch {}
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', (err) => reject(err));
  });
}

function isAuthorized(req) {
  if (!TOKEN) return true;
  return req.headers['x-updater-token'] === TOKEN;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  send(res, 401, { error: 'unauthorized' });
  return false;
}

function isValidJobId(id) {
  // Job IDs are generated via Date.now().toString()
  return typeof id === 'string' && /^[0-9]{8,20}$/.test(id);
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

  // 列出所有任务（仅文件名）
  if (req.method === 'GET' && url.pathname === '/jobs') {
    if (!requireAuth(req, res)) return;
    try {
      const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
      const jobs = files.map((f) => {
        const id = f.replace(/\.log$/, '');
        let sizeBytes = 0;
        let updatedAt = null;
        try {
          const st = statSync(join(LOG_DIR, f));
          sizeBytes = st.size || 0;
          updatedAt = st.mtime ? st.mtime.toISOString() : null;
        } catch {}
        return { id, sizeBytes, updatedAt };
      });
      return send(res, 200, { success: true, jobs });
    } catch (e) {
      return send(res, 500, { success: false, error: e?.message || 'failed to list jobs' });
    }
  }

  // 获取单个任务日志（支持tail=行数）
  if (req.method === 'GET' && url.pathname.startsWith('/jobs/')) {
    if (!requireAuth(req, res)) return;
    const id = url.pathname.split('/')[2];
    if (!isValidJobId(id)) {
      return send(res, 400, { success: false, error: 'invalid_job_id' });
    }
    const rawTail = Number(url.searchParams.get('tail') || 500);
    const tail = Math.max(0, Math.min(Number.isFinite(rawTail) ? rawTail : 500, 5000));
    const logfile = join(LOG_DIR, `${id}.log`);
    try {
      const content = readFileSync(logfile, 'utf8');
      const lines = content.split(/\r?\n/);
      const sliced = tail > 0 ? lines.slice(-tail) : lines;
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(sliced.join('\n'));
    } catch (e) {
      return send(res, 404, { success: false, error: 'log not found' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/update') {
    if (!requireAuth(req, res)) return;

    const rawLen = Number(req.headers['content-length'] || 0);
    if (rawLen && rawLen > MAX_BODY_BYTES) {
      return send(res, 413, { error: 'payload_too_large' });
    }

    let body = {};
    try {
      body = await parseBody(req);
    } catch (e) {
      const status = e?.statusCode === 413 ? 413 : 400;
      return send(res, status, { error: status === 413 ? 'payload_too_large' : 'invalid_body' });
    }
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
