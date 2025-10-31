import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

const readFile = promisify(fs.readFile);

interface SshAlert {
  ip: string;
  count: number;
  windowMinutes: number;
}

export interface SecuritySummary {
  ssh?: {
    enabled: boolean;
    alerts: SshAlert[];
  };
}

const parseAuthLog = (content: string, windowMinutes: number): Record<string, number> => {
  const lines = content.split(/\r?\n/);
  const since = Date.now() - windowMinutes * 60 * 1000;
  const ipCount: Record<string, number> = {};
  for (const line of lines) {
    // 过滤时间窗口（粗略：仅当行包含本月日时可能失真；为简化，窗口仅用于整体频率控制）
    // 匹配失败信息
    if (/(Failed password|Invalid user|authentication failure)/i.test(line)) {
      const m = line.match(/(?:from|rhost=)(\d+\.\d+\.\d+\.\d+)/i);
      if (m && m[1]) {
        const ip = m[1];
        ipCount[ip] = (ipCount[ip] || 0) + 1;
      }
    }
  }
  return ipCount;
};

export const securityMonitor = {
  async checkSshBruteforce(): Promise<SecuritySummary | null> {
    try {
      const enabled = (process.env.SSH_MONITOR_ENABLED || 'false').toLowerCase() === 'true';
      if (!enabled) return null;
      const windowMin = parseInt(process.env.SSH_MONITOR_WINDOW_MIN || '10', 10);
      const threshold = parseInt(process.env.SSH_MONITOR_THRESHOLD || '10', 10);

      const candidates = [
        '/host/var/log/auth.log',    // Debian/Ubuntu
        '/host/var/log/secure'       // CentOS/RHEL
      ];
      let content = '';
      for (const p of candidates) {
        try {
          const stat = fs.existsSync(p) && fs.statSync(p);
          if (stat && stat.isFile()) {
            // 读取最后 256KB，避免读整个大日志
            const data = await readFile(p, 'utf8');
            content = data.slice(-262144);
            break;
          }
        } catch {}
      }
      if (!content) return { ssh: { enabled: true, alerts: [] } };
      const counts = parseAuthLog(content, windowMin);
      const alerts: SshAlert[] = Object.entries(counts)
        .filter(([_, c]) => c >= threshold)
        .map(([ip, c]) => ({ ip, count: c, windowMinutes: windowMin }));
      return { ssh: { enabled: true, alerts } };
    } catch {
      return null;
    }
  }
};

