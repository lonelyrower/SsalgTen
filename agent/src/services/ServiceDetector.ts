import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import type { Dirent } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { logger } from '../utils/logger';
import type { DetectedService, ServiceType, ServiceStatus } from '../types';
import { XrayConfigParser } from './parsers/XrayConfigParser';
import { NginxConfigParser } from './parsers/NginxConfigParser';

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
    81: { type: 'WEB' as ServiceType, protocol: 'http', hint: 'Nginx Proxy Manager' },
    2368: { type: 'WEB' as ServiceType, protocol: 'http', hint: 'Ghost' },
    3000: { type: 'WEB' as ServiceType, protocol: 'http', hint: 'Node.js/React' },
    4000: { type: 'WEB' as ServiceType, protocol: 'http' },
    5000: { type: 'WEB' as ServiceType, protocol: 'http' },
    8000: { type: 'WEB' as ServiceType, protocol: 'http' },
    8080: { type: 'WEB' as ServiceType, protocol: 'http' },
    8443: { type: 'WEB' as ServiceType, protocol: 'https' },
    9000: { type: 'WEB' as ServiceType, protocol: 'http' },

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

  private nodeIp?: string;

  /**
   * 检测所有服务
   */
  async detectAll(nodeIp?: string): Promise<DetectedService[]> {
    logger.info('[ServiceDetector] Starting service detection...');
    this.nodeIp = nodeIp;
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

  private async populateXrayConfigInfo(configPath: string, service: DetectedService): Promise<void> {
    try {
      const stats = await fs.stat(configPath);
      const aggregatedProtocols = new Set<string>();
      const aggregatedPorts = new Set<number>();
      const aggregatedDomains = new Set<string>();
      const aggregatedLinks: string[] = [];
      const configEntries: Array<{
        file: string;
        protocols: string[];
        ports: number[];
        domains: string[];
        shareLinks: string[];
      }> = [];

      const handleConfig = async (fullPath: string, displayedName: string) => {
        logger.info(`[ServiceDetector] Parsing Xray config: ${fullPath}`);
        const configInfo = await XrayConfigParser.parse(fullPath);
        if (!configInfo) {
          logger.warn(`[ServiceDetector] Xray config parsing returned null for ${fullPath}`);
          return;
        }

        configEntries.push({
          file: displayedName,
          protocols: configInfo.protocols,
          ports: configInfo.ports,
          domains: configInfo.domains,
          shareLinks: configInfo.shareLinks,
        });

        configInfo.protocols.forEach((p) => aggregatedProtocols.add(p));
        configInfo.ports.forEach((p) => aggregatedPorts.add(p));
        configInfo.domains.forEach((d) => aggregatedDomains.add(d));
        aggregatedLinks.push(...configInfo.shareLinks);
      };

      if (stats.isDirectory()) {
        const entries = await fs.readdir(configPath, { withFileTypes: true });
        const jsonFiles = entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.endsWith('.json') &&
              !entry.name.includes('-link')
          )
          .map((entry) => entry.name)
          .sort();

        if (jsonFiles.length === 0) {
          logger.warn(`[ServiceDetector] Xray config directory ${configPath} contains no json files`);
        }

        for (const fileName of jsonFiles) {
          await handleConfig(path.join(configPath, fileName), fileName);
        }
      } else {
        await handleConfig(configPath, path.basename(configPath));
      }

      if (configEntries.length === 0) {
        return;
      }

      if (aggregatedPorts.size > 0 && !service.port) {
        service.port = Array.from(aggregatedPorts)[0];
      }

      if (aggregatedProtocols.size > 0) {
        service.protocol = Array.from(aggregatedProtocols).join(',');
      }

      if (aggregatedDomains.size > 0) {
        service.domains = Array.from(aggregatedDomains);
      }

      service.details = {
        ...service.details,
        protocols: Array.from(aggregatedProtocols),
        ports: Array.from(aggregatedPorts),
        domains: Array.from(aggregatedDomains),
        shareLinks: aggregatedLinks,
        xrayConfigs: configEntries,
      };
    } catch (error) {
      logger.error(`[ServiceDetector] Failed to parse Xray config ${configPath}:`, error);
    }
  }

  /**
   * 检测常见进程服务
   */
  private async detectProcessServices(): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    // 首先检测是否在容器内运行
    const isInContainer = await this.isRunningInContainer();
    const processes = await this.collectProcessList(isInContainer);

    if (processes.length === 0) {
      logger.warn('[ServiceDetector] Unable to collect process list; skipping process-based detection');
      return services;
    }

    // 定义需要检测的服务及其特征
    const servicePatterns = [
      // 代理服务
      { name: 'Xray', pattern: /xray/i, type: 'PROXY' as ServiceType },
      { name: 'V2Ray', pattern: /v2ray/i, type: 'PROXY' as ServiceType },
      // 注意：Hysteria2 必须在 Hysteria 之前，避免被 hysteria 的正则匹配
      { name: 'Hysteria2', pattern: /hysteria2/i, type: 'PROXY' as ServiceType },
      { name: 'Hysteria', pattern: /hysteria(?!2)/i, type: 'PROXY' as ServiceType },
      { name: 'Sing-box', pattern: /sing-box/i, type: 'PROXY' as ServiceType },
      { name: 'ShadowsocksR', pattern: /ssr-server|ssserver/i, type: 'PROXY' as ServiceType },
      { name: 'Shadowsocks', pattern: /ss-server|shadowsocks/i, type: 'PROXY' as ServiceType },
      { name: 'Trojan', pattern: /trojan-go|trojan/i, type: 'PROXY' as ServiceType },
      { name: 'Clash', pattern: /clash/i, type: 'PROXY' as ServiceType },
      { name: 'NaiveProxy', pattern: /naive/i, type: 'PROXY' as ServiceType },
      { name: 'Brook', pattern: /brook/i, type: 'PROXY' as ServiceType },
      { name: 'Gost', pattern: /gost/i, type: 'PROXY' as ServiceType },

      // Web 服务器
      { name: 'Nginx', pattern: /nginx/i, type: 'WEB' as ServiceType },
      { name: 'Apache', pattern: /apache2|httpd/i, type: 'WEB' as ServiceType },
      { name: 'Caddy', pattern: /caddy/i, type: 'WEB' as ServiceType },
      { name: 'Lighttpd', pattern: /lighttpd/i, type: 'WEB' as ServiceType },
      { name: 'OpenResty', pattern: /openresty/i, type: 'WEB' as ServiceType },

      // 数据库
      { name: 'MySQL', pattern: /mysqld/i, type: 'DATABASE' as ServiceType },
      { name: 'PostgreSQL', pattern: /postgres/i, type: 'DATABASE' as ServiceType },
      { name: 'Redis', pattern: /redis-server/i, type: 'DATABASE' as ServiceType },
      { name: 'MongoDB', pattern: /mongod/i, type: 'DATABASE' as ServiceType },
      { name: 'MariaDB', pattern: /mariadbd/i, type: 'DATABASE' as ServiceType },

      // 容器
      { name: 'Docker', pattern: /dockerd/i, type: 'CONTAINER' as ServiceType },
      { name: 'Containerd', pattern: /containerd/i, type: 'CONTAINER' as ServiceType },
    ];

    try {
      for (const pattern of servicePatterns) {
        const matchedProcess = processes.find((proc) => pattern.pattern.test(proc));

        if (!matchedProcess) {
          continue;
        }

        if (pattern.name === 'Nginx') {
          const normalizedProcess = matchedProcess.toLowerCase();
          const nginxEvidence = /(?:^|\s|\/)nginx(?:\s|$|:)/.test(normalizedProcess) || normalizedProcess.includes('/nginx');

          if (!nginxEvidence) {
            logger.debug(
              `[ServiceDetector] Ignoring potential Nginx match without executable evidence: ${matchedProcess}`
            );
            continue;
          }
        }

        const configHints = this.extractConfigHints(pattern.name, matchedProcess);
        if (configHints.length === 0 && pattern.name === 'Xray') {
          logger.debug(
            `[ServiceDetector] No valid config hints detected for Xray from process: ${matchedProcess}`
          );
        }

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
        const configPath = await this.getServiceConfigPath(pattern.name, configHints);
        if (configPath) {
          logger.info(`[ServiceDetector] Found config for ${pattern.name}: ${configPath}`);
          service.configPath = configPath;
          service.configHash = await this.getFileHash(configPath);

          // 解析配置文件以获取详细信息
          await this.parseServiceConfig(pattern.name, configPath, service);
        } else if (configHints.length > 0) {
          service.configPath = configHints[0];
          logger.debug(
            `[ServiceDetector] No accessible config found for ${pattern.name}, recorded hint: ${configHints[0]}`
          );
        } else {
          logger.debug(`[ServiceDetector] No config file found for ${pattern.name}`);
        }

        // 尝试获取监听端口
        const port = await this.getServicePort(pattern.name);
        if (port) {
          service.port = port;
        }

        services.push(service);
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
    let npmProxyHosts: Array<{ domain: string; forwardHost: string; forwardPort: number }> = [];

    try {
      // 检查 Docker 是否可用
      await execAsync('docker --version');

      // 获取运行中的容器
      const { stdout } = await execAsync(
        'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"'
      );

      const containers = stdout.trim().split('\n').filter(Boolean);

      // 先检测是否有 NPM 容器，并获取其代理配置
      let npmContainerId: string | undefined;
      for (const containerLine of containers) {
        const [id, name, image] = containerLine.split('|');
        const imageLower = image.toLowerCase();

        if (imageLower.includes('nginxproxymanager') || imageLower.includes('nginx-proxy-manager')) {
          npmContainerId = id;
          npmProxyHosts = await this.getNpmProxyHosts(id);
          logger.info(`[ServiceDetector] Found ${npmProxyHosts.length} proxy hosts from NPM database`);

          // 尝试从 NPM 的配置文件中读取域名（作为数据库查询的补充）
          const configDomains = await this.getNpmDomainsFromConfig(id);
          if (configDomains.length > 0) {
            logger.info(`[ServiceDetector] Found ${configDomains.length} additional domains from NPM config files`);
            // 合并配置文件中的域名到 npmProxyHosts
            configDomains.forEach(domain => {
              if (!npmProxyHosts.some(host => host.domain === domain)) {
                npmProxyHosts.push({ domain, forwardHost: '', forwardPort: 0 });
              }
            });
          }
          break;
        }
      }

      for (const containerLine of containers) {
        const [id, name, image, status, ports] = containerLine.split('|');

        // 获取容器详细信息（包括 labels 和环境变量）
        const containerDetails = await this.getDockerContainerDetails(id);

        // 解析所有端口映射
        const parsedPorts = this.parseDockerPorts(ports);
        const primaryPort = parsedPorts[0];

        // 根据镜像名、容器名和标签识别服务类型
        const serviceInfo = this.identifyContainerService(image, name, containerDetails);

        const service: DetectedService = {
          serviceName: serviceInfo.name || name || image.split(':')[0],
          serviceType: serviceInfo.type,
          status: status.toLowerCase().includes('up') ? 'RUNNING' : 'STOPPED',
          port: primaryPort,
          protocol: serviceInfo.protocol,
          containerInfo: {
            id: id.substring(0, 12),
            image,
            state: status,
          },
          details: {
            fullPorts: ports,
            allPorts: parsedPorts,
            ...containerDetails,
          },
        };

        // 如果有域名信息，添加到服务
        if (serviceInfo.domains && serviceInfo.domains.length > 0) {
          service.domains = serviceInfo.domains;
        }

        // 尝试从 NPM 配置中匹配域名（根据容器名或端口）
        if (npmProxyHosts.length > 0) {
          // 如果是 NPM 容器本身，添加所有代理的域名
          if (id === npmContainerId) {
            const allNpmDomains = npmProxyHosts.map(host => host.domain).filter(Boolean);
            if (allNpmDomains.length > 0) {
              service.domains = [...(service.domains || []), ...allNpmDomains];
              service.domains = Array.from(new Set(service.domains));
            }
          }
          // 对于其他 Web 服务，尝试匹配域名
          else if (serviceInfo.type === 'WEB') {
            const matchedDomains = this.matchNpmDomains(name, parsedPorts, npmProxyHosts);
            if (matchedDomains.length > 0) {
              service.domains = [...(service.domains || []), ...matchedDomains];
              // 去重
              service.domains = Array.from(new Set(service.domains));
            }
          }
        }

        services.push(service);
      }
    } catch (error) {
      // Docker 未安装或不可用，跳过
      logger.debug('[ServiceDetector] Docker not available or no containers running');
    }

    return services;
  }

  /**
   * 从 NPM 容器获取代理主机配置
   */
  private async getNpmProxyHosts(containerId: string): Promise<Array<{ domain: string; forwardHost: string; forwardPort: number }>> {
    try {
      // NPM 使用 proxy_host 表存储代理配置
      // 查询所有启用的代理主机配置
      const { stdout } = await execAsync(
        `docker exec ${containerId} sqlite3 -separator '|' /data/database.sqlite "SELECT domain_names, forward_host, forward_port FROM proxy_host WHERE enabled = 1;" 2>/dev/null || echo ""`
      );

      if (!stdout || !stdout.trim()) {
        logger.debug('[ServiceDetector] No data from NPM database query');
        return [];
      }

      const lines = stdout.trim().split('\n');
      const proxyHosts: Array<{ domain: string; forwardHost: string; forwardPort: number }> = [];

      for (const line of lines) {
        const [domainsJson, host, port] = line.split('|');
        if (domainsJson && host && port) {
          try {
            // domain_names 是 JSON 数组，如 ["example.com", "www.example.com"]
            const domains = JSON.parse(domainsJson) as string[];
            for (const domain of domains) {
              proxyHosts.push({
                domain: domain.trim(),
                forwardHost: host.trim(),
                forwardPort: parseInt(port.trim(), 10),
              });
            }
          } catch (jsonError) {
            // 如果不是 JSON，可能是单个域名
            logger.debug(`[ServiceDetector] Failed to parse NPM domains JSON: ${domainsJson}`);
            proxyHosts.push({
              domain: domainsJson.trim(),
              forwardHost: host.trim(),
              forwardPort: parseInt(port.trim(), 10),
            });
          }
        }
      }

      return proxyHosts;
    } catch (error) {
      logger.debug('[ServiceDetector] Failed to query NPM database:', error);
      return [];
    }
  }

  /**
   * 从 NPM 容器的配置文件中提取域名
   */
  private async getNpmDomainsFromConfig(containerId: string): Promise<string[]> {
    try {
      // NPM 的配置文件通常在 /data/nginx/proxy_host/ 目录下
      const { stdout } = await execAsync(
        `docker exec ${containerId} find /data/nginx/proxy_host -name "*.conf" -type f 2>/dev/null || echo ""`
      );

      if (!stdout || !stdout.trim()) {
        logger.debug('[ServiceDetector] No NPM config files found');
        return [];
      }

      const configFiles = stdout.trim().split('\n').filter(Boolean);
      const domains = new Set<string>();

      for (const configFile of configFiles) {
        try {
          // 读取配置文件内容
          const { stdout: content } = await execAsync(
            `docker exec ${containerId} cat "${configFile}" 2>/dev/null || echo ""`
          );

          if (!content) continue;

          // 使用正则提取 server_name 指令
          const serverNameMatches = content.matchAll(/server_name\s+([^;]+);/g);
          for (const match of serverNameMatches) {
            const serverNames = match[1]
              .trim()
              .split(/\s+/)
              .filter((name) => name && name !== '_' && !name.startsWith('#'));
            serverNames.forEach(domain => domains.add(domain));
          }
        } catch (error) {
          logger.debug(`[ServiceDetector] Failed to read NPM config file ${configFile}:`, error);
        }
      }

      return Array.from(domains);
    } catch (error) {
      logger.debug('[ServiceDetector] Failed to read NPM config files:', error);
      return [];
    }
  }

  /**
   * 根据容器名和端口匹配 NPM 代理域名
   */
  private matchNpmDomains(
    containerName: string,
    ports: number[],
    npmProxyHosts: Array<{ domain: string; forwardHost: string; forwardPort: number }>
  ): string[] {
    const domains: string[] = [];

    for (const proxyHost of npmProxyHosts) {
      // 匹配容器名（忽略大小写）
      if (proxyHost.forwardHost.toLowerCase().includes(containerName.toLowerCase()) ||
          containerName.toLowerCase().includes(proxyHost.forwardHost.toLowerCase())) {
        domains.push(proxyHost.domain);
      }

      // 匹配端口
      if (ports.includes(proxyHost.forwardPort)) {
        domains.push(proxyHost.domain);
      }
    }

    return Array.from(new Set(domains));
  }

  /**
   * 解析 Docker 端口字符串
   */
  private parseDockerPorts(portsString: string): number[] {
    const ports: number[] = [];
    // 匹配格式: 0.0.0.0:port, :::port, *:port
    const portMatches = portsString.matchAll(/[0-9.*:]+:(\d+)/g);

    for (const match of portMatches) {
      const port = parseInt(match[1], 10);
      if (port && !ports.includes(port)) {
        ports.push(port);
      }
    }

    return ports;
  }

  /**
   * 获取 Docker 容器详细信息
   */
  private async getDockerContainerDetails(containerId: string): Promise<Record<string, unknown>> {
    try {
      const { stdout } = await execAsync(
        `docker inspect --format '{{json .Config.Labels}}|{{json .Config.Env}}' ${containerId}`
      );

      const [labelsJson, envJson] = stdout.trim().split('|');

      const labels = labelsJson ? JSON.parse(labelsJson) : {};
      const env = envJson ? JSON.parse(envJson) : [];

      return {
        labels,
        env: this.parseEnvArray(env),
      };
    } catch (error) {
      logger.debug(`[ServiceDetector] Failed to get container details for ${containerId}:`, error);
      return {};
    }
  }

  /**
   * 解析环境变量数组为对象
   */
  private parseEnvArray(envArray: string[]): Record<string, string> {
    const envObj: Record<string, string> = {};
    for (const envVar of envArray) {
      const [key, ...valueParts] = envVar.split('=');
      if (key) {
        envObj[key] = valueParts.join('=');
      }
    }
    return envObj;
  }

  /**
   * 根据镜像名、容器名和标签识别容器服务类型
   */
  private identifyContainerService(
    image: string,
    name: string,
    details: Record<string, unknown>
  ): { name: string; type: ServiceType; protocol?: string; domains?: string[] } {
    const imageLower = image.toLowerCase();
    const nameLower = name.toLowerCase();
    const labels = (details.labels as Record<string, string>) || {};
    const env = (details.env as Record<string, string>) || {};

    // 从环境变量中提取域名
    const domains: string[] = [];
    if (env.VIRTUAL_HOST) {
      domains.push(...env.VIRTUAL_HOST.split(',').map(d => d.trim()));
    }
    if (env.url && env.url.startsWith('http')) {
      try {
        const urlObj = new URL(env.url);
        domains.push(urlObj.hostname);
      } catch {}
    }

    // Nginx Proxy Manager
    if (imageLower.includes('nginxproxymanager') || imageLower.includes('nginx-proxy-manager')) {
      return {
        name: 'Nginx Proxy Manager',
        type: 'WEB',
        protocol: 'http',
        domains,
      };
    }

    // Ghost
    if (imageLower.includes('ghost')) {
      return {
        name: 'Ghost',
        type: 'WEB',
        protocol: 'http',
        domains,
      };
    }

    // Nginx
    if (imageLower.includes('nginx')) {
      return {
        name: 'Nginx',
        type: 'WEB',
        protocol: 'http',
        domains,
      };
    }

    // WordPress
    if (imageLower.includes('wordpress')) {
      return {
        name: 'WordPress',
        type: 'WEB',
        protocol: 'http',
        domains,
      };
    }

    // 代理服务
    if (imageLower.includes('xray') || imageLower.includes('v2ray')) {
      return { name: imageLower.includes('xray') ? 'Xray' : 'V2Ray', type: 'PROXY' };
    }
    if (imageLower.includes('trojan')) {
      return { name: 'Trojan', type: 'PROXY' };
    }
    // 先检查 hysteria2，再检查 hysteria
    if (imageLower.includes('hysteria2')) {
      return { name: 'Hysteria2', type: 'PROXY' };
    }
    if (imageLower.includes('hysteria')) {
      return { name: 'Hysteria', type: 'PROXY' };
    }
    if (imageLower.includes('shadowsocks')) {
      return { name: 'Shadowsocks', type: 'PROXY' };
    }

    // 数据库
    if (imageLower.includes('mysql') || imageLower.includes('mariadb')) {
      return { name: imageLower.includes('mariadb') ? 'MariaDB' : 'MySQL', type: 'DATABASE', protocol: 'mysql' };
    }
    if (imageLower.includes('postgres')) {
      return { name: 'PostgreSQL', type: 'DATABASE', protocol: 'postgresql' };
    }
    if (imageLower.includes('redis')) {
      return { name: 'Redis', type: 'DATABASE', protocol: 'redis' };
    }
    if (imageLower.includes('mongo')) {
      return { name: 'MongoDB', type: 'DATABASE', protocol: 'mongodb' };
    }

    // 默认：保留容器名称或镜像名
    return {
      name: name || image.split(':')[0],
      type: 'CONTAINER',
      domains,
    };
  }

  /**
   * 根据进程命令提取配置文件线索
   */
  private extractConfigHints(serviceName: string, processCommand?: string): string[] {
    if (!processCommand) return [];

    const hints = new Set<string>();
    const args = this.tokenizeCommand(processCommand);

    const push = (candidate?: string) => {
      const normalized = this.normalizeConfigPathCandidate(serviceName, candidate);
      if (normalized) {
        hints.add(normalized);
      }
    };

    if (serviceName === 'Xray' || serviceName === 'V2Ray') {
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-c' || arg === '-config' || arg === '--config') {
          push(args[i + 1]);
          i++;
          continue;
        }
        const match = arg.match(/^--config(?:dir)?=(.+)$/);
        if (match) {
          push(match[1]);
        }
      }
    } else if (serviceName === 'Nginx') {
      let prefix: string | undefined;
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-c') {
          push(args[i + 1]);
          i++;
          continue;
        }
        if (arg.startsWith('-c')) {
          const match = arg.match(/^-c(.+)$/);
          if (match) push(match[1]);
          continue;
        }
        if (arg === '-p') {
          prefix = this.normalizeConfigPathCandidate(serviceName, args[i + 1]);
          i++;
          continue;
        }
        const prefixMatch = arg.match(/^-p(.+)$/);
        if (prefixMatch) {
          prefix = this.normalizeConfigPathCandidate(serviceName, prefixMatch[1]);
        }
      }
      if (prefix) {
        push(path.join(prefix, 'conf', 'nginx.conf'));
      }

      const directMatch = processCommand.match(/\/[^\s]+nginx\.conf/);
      if (directMatch) {
        push(directMatch[0]);
      }
    }

    return Array.from(hints);
  }

  /**
   * 将进程命令拆分为参数，兼容 cmdline 的 \0 分隔及简单引号
   */
  private tokenizeCommand(command: string): string[] {
    if (!command) return [];

    // cmdline 替换 \0 为空格后已基本分割，此处再按空白拆分
    const parts = command
      .replace(/\0/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    return parts;
  }

  /**
   * 收集进程列表，兼容缺少传统 ps 命令的精简发行版
   */
  private async collectProcessList(isInContainer: boolean): Promise<string[]> {
    const processSets: string[][] = [];

    if (isInContainer) {
      const hostProcs = await this.readProcessesFromProc('/host/proc');
      if (hostProcs.length > 0) {
        processSets.push(hostProcs);
      }
    }

    const psProcs = await this.getProcessesViaPs();
    if (psProcs.length > 0) {
      processSets.push(psProcs);
    }

    const localProcs = await this.readProcessesFromProc('/proc');
    if (localProcs.length > 0) {
      processSets.push(localProcs);
    }

    if (processSets.length === 0) {
      return [];
    }

    const merged = processSets.flat();
    return Array.from(new Set(merged.map((p) => p.trim()).filter((p) => p.length > 0)));
  }

  /**
   * 尝试通过常见的 ps 变体获取进程列表
   */
  private async getProcessesViaPs(): Promise<string[]> {
    const commands = [
      'ps aux 2>/dev/null',
      'ps -eo pid,cmd 2>/dev/null',
      'ps -ef 2>/dev/null',
      'ps 2>/dev/null',
      'busybox ps 2>/dev/null',
    ];

    for (const command of commands) {
      try {
        const { stdout } = await execAsync(command);
        const lines = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) continue;

        // 去除可能的表头行
        const first = lines[0].toUpperCase();
        if (
          first.includes('PID') &&
          (first.includes('USER') || first.includes('COMMAND') || first.includes('CMD'))
        ) {
          lines.shift();
        }

        if (lines.length > 0) {
          return lines;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  /**
   * 直接从 /proc 枚举进程，兼容 BusyBox 等环境
   */
  private async readProcessesFromProc(procRoot: string): Promise<string[]> {
    try {
      const entries: Dirent[] = await fs.readdir(procRoot, { withFileTypes: true });
      const processes: string[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pid = entry.name;
        if (!/^\d+$/.test(pid)) continue;

        const basePath = path.join(procRoot, pid);
        let command: string | undefined;

        try {
          const cmdline = await fs.readFile(path.join(basePath, 'cmdline'));
          const normalized = cmdline.toString('utf8').replace(/\0/g, ' ').trim();
          if (normalized.length > 0) {
            command = normalized;
          }
        } catch {}

        if (!command) {
          try {
            const comm = await fs.readFile(path.join(basePath, 'comm'), 'utf8');
            const normalized = comm.trim();
            if (normalized.length > 0) {
              command = normalized;
            }
          } catch {}
        }

        if (!command) {
          try {
            const exePath = await fs.readlink(path.join(basePath, 'exe'));
            if (exePath && exePath.length > 0) {
              command = exePath;
            }
          } catch {}
        }

        if (command) {
          processes.push(command);
        }
      }

      return processes;
    } catch (error) {
      logger.debug(`[ServiceDetector] Unable to enumerate processes from ${procRoot}:`, error);
      return [];
    }
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
            let serviceName: string;

            if (processMatch && processMatch[1]) {
              serviceName = processMatch[1];
            } else if ('hint' in portInfo && portInfo.hint) {
              // 使用端口提示作为服务名
              serviceName = portInfo.hint;
            } else {
              serviceName = `Web Service (Port ${port})`;
            }

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
      const output = stdout.trim();

      // 过滤掉错误信息
      if (!output ||
          output.includes('not found') ||
          output.includes('No such file') ||
          output.includes('command not found') ||
          output.includes('/bin/sh:') ||
          output.includes('/bin/bash:')) {
        return undefined;
      }

      // 提取版本号
      const versionMatch = output.match(/\d+\.\d+\.\d+/);
      return versionMatch ? versionMatch[0] : output.substring(0, 50);
    } catch {
      return undefined;
    }
  }

  private normalizeConfigPathCandidate(
    serviceName: string,
    candidate?: string
  ): string | undefined {
    if (!candidate) return undefined;
    const trimmed = candidate.trim().replace(/^['"]|['"]$/g, '');
    if (!trimmed) return undefined;
    if (!path.isAbsolute(trimmed)) return undefined;

    const normalized = trimmed.replace(/\/{2,}/g, '/').replace(/\/+$/, '');

    if (serviceName === 'Xray' && this.isDefaultXrayConfigPath(normalized)) {
      return undefined;
    }

    return normalized || '/';
  }

  private isDefaultXrayConfigPath(candidate: string): boolean {
    const normalized = candidate.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return (
      normalized === '/etc/xray/config.json' ||
      normalized === '/usr/local/etc/xray/config.json'
    );
  }

  /**
   * 获取服务配置文件路径
   */
  private async getServiceConfigPath(
    serviceName: string,
    hintPaths: string[] = []
  ): Promise<string | undefined> {
    const configPaths: Record<string, string[]> = {
      'Xray': [
        '/etc/xray/conf',
        '/usr/local/etc/xray/conf',
      ],
      'Hysteria': ['/etc/hysteria/config.yaml', '/etc/hysteria/config.yml'],
      'Hysteria2': ['/etc/hysteria/config.yaml', '/etc/hysteria/config.yml'],
      'V2Ray': ['/etc/v2ray/config.json', '/usr/local/etc/v2ray/config.json'],
      'Nginx': ['/etc/nginx/nginx.conf'],
      'Apache': ['/etc/apache2/apache2.conf', '/etc/httpd/conf/httpd.conf'],
      'Caddy': ['/etc/caddy/Caddyfile'],
      'MySQL': ['/etc/mysql/my.cnf'],
      'PostgreSQL': ['/etc/postgresql/postgresql.conf'],
      'Redis': ['/etc/redis/redis.conf'],
    };

    const paths = configPaths[serviceName] || [];
    const candidates = [...hintPaths, ...paths]
      .map((candidate) => this.normalizeConfigPathCandidate(serviceName, candidate))
      .filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        await fs.access(candidate, fsConstants.R_OK);
        return candidate;
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
      const stat = await fs.stat(filePath);
      const hash = crypto.createHash('md5');

      if (stat.isDirectory()) {
        const entries = await fs.readdir(filePath, { withFileTypes: true });
        const jsonFiles = entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name)
          .sort();

        if (jsonFiles.length === 0) {
          return undefined;
        }

        for (const name of jsonFiles) {
          const fullPath = path.join(filePath, name);
          const content = await fs.readFile(fullPath, 'utf-8');
          hash.update(name);
          hash.update(content);
        }
      } else {
        const content = await fs.readFile(filePath, 'utf-8');
        hash.update(content);
      }

      return hash.digest('hex').substring(0, 16);
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
   * 解析服务配置文件
   */
  private async parseServiceConfig(
    serviceName: string,
    configPath: string,
    service: DetectedService
  ): Promise<void> {
    try {
      // Xray / V2Ray 配置解析
      if (serviceName === 'Xray') {
        await this.populateXrayConfigInfo(configPath, service);
      } else if (serviceName === 'V2Ray') {
        logger.info(`[ServiceDetector] Parsing ${serviceName} config: ${configPath}`);
        const configInfo = await XrayConfigParser.parse(configPath);
        if (configInfo) {
          logger.info(`[ServiceDetector] ${serviceName} parsed - Protocols: ${configInfo.protocols.join(',')}, Domains: ${configInfo.domains.length}, Links: ${configInfo.shareLinks.length}`);

          service.details = {
            ...service.details,
            protocols: configInfo.protocols,
            ports: configInfo.ports,
            domains: configInfo.domains,
            shareLinks: configInfo.shareLinks,
          };

          // 如果有端口信息，使用第一个端口
          if (configInfo.ports.length > 0 && !service.port) {
            service.port = configInfo.ports[0];
          }

          // 如果有协议信息，使用第一个协议
          if (configInfo.protocols.length > 0) {
            service.protocol = configInfo.protocols[0];
          }

          // 如果有域名信息，添加到 details
          if (configInfo.domains.length > 0) {
            service.domains = configInfo.domains;
          }
        } else {
          logger.warn(`[ServiceDetector] ${serviceName} config parsing returned null`);
        }
      } else if (serviceName === 'Hysteria' || serviceName === 'Hysteria2') {
        await this.populateHysteriaInfo(serviceName, configPath, service);
      }
      // Nginx 配置解析
      else if (serviceName === 'Nginx') {
        logger.info(`[ServiceDetector] Parsing Nginx config: ${configPath}`);
        const configInfo = await NginxConfigParser.parseWithIncludes(configPath);
        if (configInfo) {
          logger.info(`[ServiceDetector] Nginx parsed - Domains: ${configInfo.domains.length}, SSL: ${configInfo.sslEnabled}, Certs: ${configInfo.sslCertificates.length}`);

          service.details = {
            ...service.details,
            sslCertificates: configInfo.sslCertificates,
          };

          // 添加域名信息
          if (configInfo.domains.length > 0) {
            service.domains = configInfo.domains;
          }

          // 添加端口信息
          if (configInfo.ports.length > 0 && !service.port) {
            service.port = configInfo.ports[0];
          }

          // 添加协议信息
          if (configInfo.protocols.length > 0) {
            service.protocol = configInfo.protocols.join(',');
          }

          // SSL 启用状态
          service.sslEnabled = configInfo.sslEnabled;
        } else {
          logger.warn(`[ServiceDetector] Nginx config parsing returned null`);
        }
      }
    } catch (error) {
      logger.error(`[ServiceDetector] Failed to parse ${serviceName} config:`, error);
    }
  }

  private async populateHysteriaInfo(
    serviceName: string,
    configPath: string,
    service: DetectedService
  ): Promise<void> {
    try {
      const shareLinkSet = new Set<string>();
      const existingLinks = Array.isArray(service.details?.shareLinks)
        ? service.details!.shareLinks
        : [];
      existingLinks.forEach((link) => {
        if (typeof link === 'string' && link.trim()) {
          shareLinkSet.add(link.trim());
        }
      });
      const primaryDomain = Array.isArray(service.domains) ? service.domains[0] : undefined;
      const nodeIp = this.nodeIp;

      const linkFiles = ['/root/hy/url.txt', '/root/hy/url-nohop.txt'];
      const availableLinkFiles: string[] = [];
      for (const filePath of linkFiles) {
        const lines = await this.readLinesIfExists(filePath);
        if (lines.length > 0) {
          availableLinkFiles.push(filePath);
          lines
            .map((line) => line.trim())
            .filter((line) => line.includes('://'))
            .forEach((line) => shareLinkSet.add(line));
        }
      }

      let clientConfig: any;
      let clientAuth: string | undefined;
      let clientServerFirst: string | undefined;
      let clientInsecure: boolean | undefined;
      let clientSni: string | undefined;
      let clientEndpointHost: string | undefined;
      let serverPassword: string | undefined;
      let listenHost: string | undefined;
      let listenPort: number | undefined;
      let masqueradeHost: string | undefined;
      try {
        const clientJson = await fs.readFile('/root/hy/hy-client.json', 'utf-8');
        clientConfig = JSON.parse(clientJson);
      } catch (error) {
        logger.debug('[ServiceDetector] Unable to read hysteria client config JSON:', error);
      }

      const hysteriaDetails: Record<string, unknown> = {
        configPath,
        shareLinkFiles: availableLinkFiles,
      };

      const domainSet = new Set<string>(service.domains || []);
      if (primaryDomain) {
        domainSet.add(primaryDomain);
      }

      if (clientConfig && typeof clientConfig === 'object') {
        const clientInfo: Record<string, unknown> = {};
        if (typeof clientConfig.server === 'string') {
          const serverValue = clientConfig.server.trim();
          if (serverValue) {
            clientInfo.server = serverValue;
            const primaryEndpoint = serverValue.split(',')[0]?.trim();
            const endpointInfo = this.parseHysteriaEndpoint(primaryEndpoint);
            clientServerFirst = primaryEndpoint;
            if (endpointInfo.host) {
              clientInfo.endpointHost = endpointInfo.host;
              clientEndpointHost = endpointInfo.host;
            }
            if (endpointInfo.port && !service.port) {
              service.port = endpointInfo.port;
            }
          }
        }
        if (clientConfig.tls && typeof clientConfig.tls === 'object') {
          clientInfo.tls = clientConfig.tls;
          clientInsecure =
            typeof clientConfig.tls.insecure === 'boolean'
              ? clientConfig.tls.insecure
              : undefined;
          const sni = this.firstNonEmptyValue(clientConfig.tls.sni, clientConfig.tls.server_name);
          if (sni) {
            domainSet.add(sni);
            clientSni = sni;
          }
        }
        if (clientConfig.quic && typeof clientConfig.quic === 'object') {
          clientInfo.quic = clientConfig.quic;
        }
        clientAuth = this.firstNonEmptyValue(clientConfig.auth);

        hysteriaDetails.client = clientInfo;

        if (shareLinkSet.size === 0) {
          const fallbackLink = this.buildHysteriaShareLink(serviceName, clientConfig);
          if (fallbackLink) {
            shareLinkSet.add(fallbackLink);
          }
        }
      }

      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const listenMatch = configContent.match(/^\s*listen:\s*("?)([^\s"#]+)\1/m);
        if (listenMatch) {
          const listenValue = listenMatch[2].trim();
          hysteriaDetails.listen = listenValue;
          const listenEndpoint = this.parseHysteriaEndpoint(
            listenValue.startsWith(':') ? `127.0.0.1${listenValue}` : listenValue
          );
          if (listenEndpoint.port) {
            listenPort = listenEndpoint.port;
            if (!service.port) {
              service.port = listenEndpoint.port;
            }
          }
          if (listenEndpoint.host) {
            listenHost = listenEndpoint.host;
            hysteriaDetails.listenHost = listenEndpoint.host;
          }
        }

        const proxyMatch = configContent.match(/^\s*url:\s*(https?:\/\/[^\s]+)/m);
        if (proxyMatch) {
          hysteriaDetails.masquerade = proxyMatch[1].trim();
          try {
            const parsedMasqueradeHost = new URL(proxyMatch[1].trim()).hostname;
            if (parsedMasqueradeHost) {
              masqueradeHost = parsedMasqueradeHost.trim();
              if (masqueradeHost) {
                domainSet.add(masqueradeHost);
              }
            }
          } catch {
            // ignore parsing errors
          }
        }

        const passwordMatch = configContent.match(/^\s*password\s*:\s*['"]?([^\s'"]+)['"]?/m);
        if (passwordMatch) {
          const password = passwordMatch[1].trim();
          if (password) {
            hysteriaDetails.password = password;
            serverPassword = password;
          }
        }

        const domainLineMatch = configContent.match(/^\s*sni\s*:\s*['"]?([^\s'"]+)['"]?/m);
        if (domainLineMatch) {
          const sni = domainLineMatch[1].trim();
          if (sni) {
            domainSet.add(sni);
          }
        }
      } catch (error) {
        logger.debug('[ServiceDetector] Unable to read hysteria server config:', error);
      }

      if (shareLinkSet.size === 0) {
        const domainList = Array.from(domainSet);
        const fallbackHost = this.firstNonEmptyValue(
          clientSni,
          clientEndpointHost,
          domainList[0],
          masqueradeHost,
          listenHost,
          nodeIp
        );
        const fallbackPort =
          service.port ||
          (clientServerFirst ? this.parseHysteriaEndpoint(clientServerFirst).port : undefined) ||
          listenPort;
        const fallbackPassword = this.firstNonEmptyValue(clientAuth, serverPassword);

        const fallbackLink = this.buildHysteriaShareLink(serviceName, clientConfig, {
          host: fallbackHost,
          port: fallbackPort,
          password: fallbackPassword,
          insecure: clientInsecure,
          sni: this.firstNonEmptyValue(clientSni, domainList[0], masqueradeHost),
        });

        if (fallbackLink) {
          shareLinkSet.add(fallbackLink);
        }
      }

      hysteriaDetails.server = {
        host: listenHost,
        port: listenPort,
        password: serverPassword,
        masqueradeHost,
      };

      const shareLinks = Array.from(shareLinkSet);
      const protocolLabel = serviceName.toLowerCase().includes('2') ? 'hysteria2' : 'hysteria';
      service.protocol = protocolLabel;

      if (domainSet.size > 0) {
        service.domains = Array.from(domainSet);
      }

      service.details = {
        ...service.details,
        ...(shareLinks.length > 0 ? { shareLinks } : {}),
        hysteria: hysteriaDetails,
      };
    } catch (error) {
      logger.warn('[ServiceDetector] Failed to process hysteria config:', error);
    }
  }

  private async readLinesIfExists(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  private parseHysteriaEndpoint(endpoint?: string): { host?: string; port?: number } {
    if (!endpoint) {
      return {};
    }

    const trimmed = endpoint.trim();
    if (!trimmed) {
      return {};
    }

    let working = trimmed;
    const commaIndex = working.indexOf(',');
    if (commaIndex !== -1) {
      working = working.slice(0, commaIndex);
    }

    let host: string | undefined;
    let port: number | undefined;

    if (working.startsWith('[')) {
      const closing = working.indexOf(']');
      if (closing !== -1) {
        host = working.slice(1, closing);
        const rest = working.slice(closing + 1);
        const portMatch = rest.match(/:(\d+)/);
        if (portMatch) {
          const parsed = parseInt(portMatch[1], 10);
          if (!Number.isNaN(parsed)) {
            port = parsed;
          }
        }
      } else {
        host = working;
      }
    } else {
      const colonIndex = working.lastIndexOf(':');
      if (colonIndex !== -1) {
        const portCandidate = working.slice(colonIndex + 1);
        const parsed = parseInt(portCandidate, 10);
        if (!Number.isNaN(parsed)) {
          port = parsed;
          host = working.slice(0, colonIndex);
        } else {
          host = working;
        }
      } else {
        host = working;
      }
    }

    return {
      host: host?.trim() || undefined,
      port,
    };
  }

  private buildHysteriaShareLink(
    serviceName: string,
    clientConfig: any,
    fallback?: {
      host?: string;
      port?: number;
      password?: string;
      insecure?: boolean;
      sni?: string;
    }
  ): string | undefined {
    const scheme = serviceName.toLowerCase().includes('2') ? 'hysteria2' : 'hysteria';

    const serverRaw =
      typeof clientConfig?.server === 'string' && clientConfig.server.trim().length > 0
        ? clientConfig.server.trim()
        : undefined;
    const primaryServer = serverRaw?.split(',')[0]?.trim();
    const endpoint = this.parseHysteriaEndpoint(primaryServer);

    const host =
      fallback?.host ||
      endpoint.host ||
      this.firstNonEmptyValue(fallback?.sni) ||
      undefined;
    const port = fallback?.port || endpoint.port;
    const password = this.firstNonEmptyValue(clientConfig?.auth, fallback?.password);

    if (!host || !port || !password) {
      return undefined;
    }

    const hostForUrl =
      host.includes(':') && !host.startsWith('[') && !host.endsWith(']')
        ? `[${host}]`
        : host;

    const params = new URLSearchParams();
    const insecure =
      typeof clientConfig?.tls?.insecure === 'boolean'
        ? clientConfig.tls.insecure
        : typeof fallback?.insecure === 'boolean'
          ? fallback.insecure
          : true;

    params.set('insecure', insecure ? '1' : '0');

    const sni = this.firstNonEmptyValue(
      clientConfig?.tls?.sni,
      clientConfig?.tls?.server_name,
      fallback?.sni
    );
    if (sni) {
      params.set('sni', sni);
    }

    const query = params.toString();
    const label = encodeURIComponent(`SsalgTen-${serviceName}`);
    return `${scheme}://${encodeURIComponent(password)}@${hostForUrl}:${port}${query ? `?${query}` : ''}#${label}`;
  }

  private firstNonEmptyValue(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return undefined;
  }

  /**
   * 检测是否在容器内运行
   */
  private async isRunningInContainer(): Promise<boolean> {
    try {
      // 检查是否存在 /.dockerenv 文件
      await fs.access('/.dockerenv');
      return true;
    } catch {
      try {
        // 检查 cgroup 是否包含 docker/containerd
        const cgroup = await fs.readFile('/proc/1/cgroup', 'utf-8');
        return /docker|containerd|kubepods/.test(cgroup);
      } catch {
        return false;
      }
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
