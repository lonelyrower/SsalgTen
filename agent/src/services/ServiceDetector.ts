import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import type { DetectedService, ServiceType, ServiceStatus } from '../types';

const execAsync = promisify(exec);

/**
 * 服务检测器
 * 负责检测系统上运行的各种服务（Xray、Nginx、Docker 等）
 */
export class ServiceDetector {
  private readonly commonPorts = {
    // Web 服务器
    80: { type: 'WEB' as ServiceType, protocol: 'http' },
    443: { type: 'WEB' as ServiceType, protocol: 'https' },
    8080: { type: 'WEB' as ServiceType, protocol: 'http' },
    8443: { type: 'WEB' as ServiceType, protocol: 'https' },

    // 代理服务
    1080: { type: 'PROXY' as ServiceType, protocol: 'socks' },
    3128: { type: 'PROXY' as ServiceType, protocol: 'http' },
    10000: { type: 'PROXY' as ServiceType, protocol: 'vmess' },
    10086: { type: 'PROXY' as ServiceType, protocol: 'trojan' },

    // 数据库
    3306: { type: 'DATABASE' as ServiceType, protocol: 'mysql' },
    5432: { type: 'DATABASE' as ServiceType, protocol: 'postgresql' },
    6379: { type: 'DATABASE' as ServiceType, protocol: 'redis' },
    27017: { type: 'DATABASE' as ServiceType, protocol: 'mongodb' },
  };

  /**
   * 检测所有服务
   */
  async detectAll(): Promise<DetectedService[]> {
    logger.info('[ServiceDetector] Starting service detection...');
    const services: DetectedService[] = [];

    try {
      // 1. 检测进程服务
      const processServices = await this.detectProcessServices();
      services.push(...processServices);

      // 2. 检测 Docker 容器
      const dockerServices = await this.detectDockerContainers();
      services.push(...dockerServices);

      // 3. 检测监听端口
      const portServices = await this.detectListeningPorts();
      services.push(...portServices);

      // 去重：优先保留更详细的信息
      const uniqueServices = this.deduplicateServices(services);

      logger.info(`[ServiceDetector] Detection completed: ${uniqueServices.length} services found`);
      return uniqueServices;
    } catch (error) {
      logger.error('[ServiceDetector] Detection failed:', error);
      return [];
    }
  }

  /**
   * 检测常见进程服务
   */
  private async detectProcessServices(): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    // 定义需要检测的服务及其特征
    const servicePatterns = [
      // 代理服务
      { name: 'Xray', pattern: /xray/i, type: 'PROXY' as ServiceType },
      { name: 'V2Ray', pattern: /v2ray/i, type: 'PROXY' as ServiceType },
      { name: 'Hysteria', pattern: /hysteria/i, type: 'PROXY' as ServiceType },
      { name: 'Sing-box', pattern: /sing-box/i, type: 'PROXY' as ServiceType },
      { name: 'ShadowsocksR', pattern: /ssr-server|ssserver/i, type: 'PROXY' as ServiceType },
      { name: 'Trojan', pattern: /trojan-go|trojan/i, type: 'PROXY' as ServiceType },

      // Web 服务器
      { name: 'Nginx', pattern: /nginx/i, type: 'WEB' as ServiceType },
      { name: 'Apache', pattern: /apache2|httpd/i, type: 'WEB' as ServiceType },
      { name: 'Caddy', pattern: /caddy/i, type: 'WEB' as ServiceType },

      // 数据库
      { name: 'MySQL', pattern: /mysqld/i, type: 'DATABASE' as ServiceType },
      { name: 'PostgreSQL', pattern: /postgres/i, type: 'DATABASE' as ServiceType },
      { name: 'Redis', pattern: /redis-server/i, type: 'DATABASE' as ServiceType },
      { name: 'MongoDB', pattern: /mongod/i, type: 'DATABASE' as ServiceType },

      // 容器
      { name: 'Docker', pattern: /dockerd/i, type: 'CONTAINER' as ServiceType },
    ];

    try {
      // 使用 ps 命令获取所有进程
      const { stdout } = await execAsync('ps aux 2>/dev/null || ps -ef 2>/dev/null');
      const processes = stdout.split('\n');

      for (const pattern of servicePatterns) {
        const matchedProcess = processes.find((proc) => pattern.pattern.test(proc));

        if (matchedProcess) {
          const service: DetectedService = {
            serviceName: pattern.name,
            serviceType: pattern.type,
            status: 'RUNNING' as ServiceStatus,
          };

          // 尝试获取版本信息
          const version = await this.getServiceVersion(pattern.name);
          if (version) {
            service.version = version;
          }

          // 尝试获取配置文件路径
          const configPath = await this.getServiceConfigPath(pattern.name);
          if (configPath) {
            service.configPath = configPath;
            service.configHash = await this.getFileHash(configPath);
          }

          // 尝试获取监听端口
          const port = await this.getServicePort(pattern.name);
          if (port) {
            service.port = port;
          }

          services.push(service);
        }
      }
    } catch (error) {
      logger.warn('[ServiceDetector] Failed to detect process services:', error);
    }

    return services;
  }

  /**
   * 检测 Docker 容器
   */
  private async detectDockerContainers(): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    try {
      // 检查 Docker 是否可用
      await execAsync('docker --version');

      // 获取运行中的容器
      const { stdout } = await execAsync(
        'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"'
      );

      const containers = stdout.trim().split('\n').filter(Boolean);

      for (const containerLine of containers) {
        const [id, name, image, status, ports] = containerLine.split('|');

        // 解析端口
        const portMatch = ports.match(/0\.0\.0\.0:(\d+)/);
        const port = portMatch ? parseInt(portMatch[1], 10) : undefined;

        const service: DetectedService = {
          serviceName: name || image.split(':')[0],
          serviceType: 'CONTAINER' as ServiceType,
          status: status.toLowerCase().includes('up') ? 'RUNNING' : 'STOPPED',
          port,
          containerInfo: {
            id: id.substring(0, 12),
            image,
            state: status,
          },
          details: {
            fullPorts: ports,
          },
        };

        services.push(service);
      }
    } catch (error) {
      // Docker 未安装或不可用，跳过
      logger.debug('[ServiceDetector] Docker not available or no containers running');
    }

    return services;
  }

  /**
   * 检测监听端口
   */
  private async detectListeningPorts(): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    try {
      // 使用 ss 或 netstat 获取监听端口
      let stdout: string;
      try {
        const result = await execAsync('ss -tlnp 2>/dev/null');
        stdout = result.stdout;
      } catch {
        const result = await execAsync('netstat -tlnp 2>/dev/null || netstat -an 2>/dev/null');
        stdout = result.stdout;
      }

      const lines = stdout.split('\n');
      const portRegex = /:(\d+)\s/;

      for (const line of lines) {
        const match = line.match(portRegex);
        if (match) {
          const port = parseInt(match[1], 10);
          const portInfo = this.commonPorts[port as keyof typeof this.commonPorts];

          if (portInfo) {
            // 尝试识别服务名称
            const processMatch = line.match(/users:\(\("([^"]+)"/);
            const serviceName = processMatch ? processMatch[1] : `Unknown (Port ${port})`;

            services.push({
              serviceName,
              serviceType: portInfo.type,
              status: 'RUNNING' as ServiceStatus,
              port,
              protocol: portInfo.protocol,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('[ServiceDetector] Failed to detect listening ports:', error);
    }

    return services;
  }

  /**
   * 获取服务版本
   */
  private async getServiceVersion(serviceName: string): Promise<string | undefined> {
    const versionCommands: Record<string, string> = {
      'Xray': 'xray version 2>/dev/null | head -n 1',
      'V2Ray': 'v2ray version 2>/dev/null | head -n 1',
      'Nginx': 'nginx -v 2>&1 | head -n 1',
      'Apache': 'apache2 -v 2>/dev/null | head -n 1 || httpd -v 2>/dev/null | head -n 1',
      'Caddy': 'caddy version 2>/dev/null',
      'MySQL': 'mysql --version 2>/dev/null',
      'PostgreSQL': 'postgres --version 2>/dev/null',
      'Redis': 'redis-server --version 2>/dev/null',
      'Docker': 'docker --version 2>/dev/null',
    };

    const command = versionCommands[serviceName];
    if (!command) return undefined;

    try {
      const { stdout } = await execAsync(command);
      // 提取版本号
      const versionMatch = stdout.match(/\d+\.\d+\.\d+/);
      return versionMatch ? versionMatch[0] : stdout.trim().substring(0, 50);
    } catch {
      return undefined;
    }
  }

  /**
   * 获取服务配置文件路径
   */
  private async getServiceConfigPath(serviceName: string): Promise<string | undefined> {
    const configPaths: Record<string, string[]> = {
      'Xray': ['/etc/xray/config.json', '/usr/local/etc/xray/config.json'],
      'V2Ray': ['/etc/v2ray/config.json', '/usr/local/etc/v2ray/config.json'],
      'Nginx': ['/etc/nginx/nginx.conf'],
      'Apache': ['/etc/apache2/apache2.conf', '/etc/httpd/conf/httpd.conf'],
      'Caddy': ['/etc/caddy/Caddyfile'],
      'MySQL': ['/etc/mysql/my.cnf'],
      'PostgreSQL': ['/etc/postgresql/postgresql.conf'],
      'Redis': ['/etc/redis/redis.conf'],
    };

    const paths = configPaths[serviceName];
    if (!paths) return undefined;

    for (const path of paths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        continue;
      }
    }

    return undefined;
  }

  /**
   * 获取文件哈希
   */
  private async getFileHash(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
    } catch {
      return undefined;
    }
  }

  /**
   * 获取服务监听端口
   */
  private async getServicePort(serviceName: string): Promise<number | undefined> {
    try {
      const { stdout } = await execAsync(
        `ss -tlnp 2>/dev/null | grep -i ${serviceName.toLowerCase()} | head -n 1`
      );
      const match = stdout.match(/:(\d+)\s/);
      return match ? parseInt(match[1], 10) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 去重服务（优先保留详细信息）
   */
  private deduplicateServices(services: DetectedService[]): DetectedService[] {
    const serviceMap = new Map<string, DetectedService>();

    for (const service of services) {
      const key = `${service.serviceName}-${service.port || 'no-port'}`;
      const existing = serviceMap.get(key);

      if (!existing) {
        serviceMap.set(key, service);
      } else {
        // 合并信息，保留更详细的数据
        const merged: DetectedService = {
          ...existing,
          ...service,
          version: service.version || existing.version,
          configPath: service.configPath || existing.configPath,
          configHash: service.configHash || existing.configHash,
          details: { ...existing.details, ...service.details },
        };
        serviceMap.set(key, merged);
      }
    }

    return Array.from(serviceMap.values());
  }
}

export const serviceDetector = new ServiceDetector();
