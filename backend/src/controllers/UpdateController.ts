import { Request, Response } from 'express';
import { APP_VERSION } from '../utils/version';
import { logger } from '../utils/logger';

const DEFAULT_OWNER = process.env.REPO_OWNER || 'lonelyrower';
const DEFAULT_REPO = process.env.REPO_NAME || 'SsalgTen';
const DEFAULT_BRANCH = process.env.REPO_BRANCH || 'main';

export class UpdateController {
  async getVersion(req: Request, res: Response) {
    const owner = (req.query.owner as string) || DEFAULT_OWNER;
    const repo = (req.query.repo as string) || DEFAULT_REPO;
    const branch = (req.query.branch as string) || DEFAULT_BRANCH;

    const localVersion = APP_VERSION;
    let latestCommit: string | null = null;
    let updateAvailable = false;
    let error: string | undefined;

    try {
      const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
      const data: any = await resp.json();
      latestCommit = (data && data.sha) ? String(data.sha) : null;
      if (latestCommit && localVersion) {
        // 只在本地像 commit 哈希时才严格比较；否则仅返回字段供前端提示
        if (/^[0-9a-f]{7,40}$/i.test(localVersion)) {
          updateAvailable = latestCommit.substring(0, localVersion.length) !== localVersion;
        }
      }
    } catch (e: any) {
      error = e?.message || 'Failed to query GitHub';
      logger.warn('Version check failed:', e);
    }

    res.json({
      success: true,
      data: {
        localVersion,
        latestCommit,
        updateAvailable,
        repo: `${owner}/${repo}`,
        branch
      },
      ...(error && { message: error })
    });
  }

  async triggerUpdate(req: Request, res: Response) {
    // 通过外部 Updater 服务执行真正的更新
    const updaterBase = (process.env.UPDATER_URL || 'http://host.docker.internal:8765/update').replace(/\/update$/, '');
    const updaterUrl = `${updaterBase}/update`;
    const updaterToken = process.env.UPDATER_TOKEN || '';
    const forceAgent = Boolean(req.body?.forceAgent);

    try {
      const resp = await fetch(updaterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(updaterToken ? { 'X-Updater-Token': updaterToken } : {}),
          'Prefer': 'respond-async'
        },
        body: JSON.stringify({ forceAgent })
      });
      const text = await resp.text();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: 'Updater error', data: { status: resp.status, body: text } });
      }
      let payload: any = undefined;
      try { payload = JSON.parse(text); } catch {}
      return res.status(202).json({ success: true, message: 'Update started', data: payload?.job ? { job: payload.job } : { raw: text } });
    } catch (e: any) {
      return res.status(501).json({
        success: false,
        error: 'Updater service not reachable. Please deploy ssalgten-updater on host.',
        data: {
          hint: 'Build and run updater: Dockerfile.updater -> container on host port 8765',
          env: { UPDATER_URL: process.env.UPDATER_URL || 'http://host.docker.internal:8765/update' }
        }
      });
    }
  }

  async getUpdateLog(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'missing id' });
    const updaterBase = (process.env.UPDATER_URL || 'http://host.docker.internal:8765/update').replace(/\/update$/, '');
    const updaterToken = process.env.UPDATER_TOKEN || '';
    try {
      const url = `${updaterBase}/jobs/${encodeURIComponent(id)}?tail=${Number(req.query.tail || 500)}`;
      const resp = await fetch(url, { headers: { ...(updaterToken ? { 'X-Updater-Token': updaterToken } : {}) } });
      const text = await resp.text();
      if (!resp.ok) return res.status(resp.status).json({ success: false, error: 'updater log error', data: { body: text } });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(text);
    } catch (e: any) {
      return res.status(502).json({ success: false, error: 'proxy failed' });
    }
  }
}

export const updateController = new UpdateController();
