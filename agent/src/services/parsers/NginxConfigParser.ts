import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';

/**
 * Nginx 配置解析器
 * 从 Nginx 配置文件中提取域名、SSL 证书等信息
 */
export class NginxConfigParser {
  /**
   * 解析 Nginx 配置文件
   */
  static async parse(configPath: string): Promise<NginxConfigInfo | null> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');

      const domains: string[] = [];
      const ports: number[] = [];
      const sslCertificates: string[] = [];
      const sslEnabled: boolean[] = [];
      const protocols: string[] = [];

      // 解析 server 块
      const serverBlocks = this.extractServerBlocks(content);

      for (const block of serverBlocks) {
        // 提取 listen 指令
        const listenMatches = block.matchAll(/listen\s+([^;]+);/g);
        for (const match of listenMatches) {
          const listenValue = match[1].trim();
          const portMatch = listenValue.match(/(\d+)/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            ports.push(port);

            // 判断是否启用 SSL
            if (listenValue.includes('ssl') || port === 443) {
              sslEnabled.push(true);
              if (!protocols.includes('https')) {
                protocols.push('https');
              }
            } else {
              if (!protocols.includes('http')) {
                protocols.push('http');
              }
            }
          }
        }

        // 提取 server_name 指令
        const serverNameMatches = block.matchAll(/server_name\s+([^;]+);/g);
        for (const match of serverNameMatches) {
          const serverNames = match[1]
            .trim()
            .split(/\s+/)
            .filter((name) => name && name !== '_' && !name.startsWith('#'));
          domains.push(...serverNames);
        }

        // 提取 SSL 证书路径
        const sslCertMatches = block.matchAll(/ssl_certificate\s+([^;]+);/g);
        for (const match of sslCertMatches) {
          const certPath = match[1].trim();
          sslCertificates.push(certPath);
        }
      }

      // 去重
      const uniqueDomains = [...new Set(domains)];
      const uniquePorts = [...new Set(ports)];
      const uniqueCerts = [...new Set(sslCertificates)];
      const hasSSL = sslEnabled.some((ssl) => ssl);

      // 验证证书是否存在及有效期
      const certInfos = await Promise.all(
        uniqueCerts.map((cert) => this.getCertificateInfo(cert))
      );

      return {
        domains: uniqueDomains,
        ports: uniquePorts,
        protocols: [...new Set(protocols)],
        sslEnabled: hasSSL,
        sslCertificates: certInfos.filter((info) => info !== null) as CertificateInfo[],
      };
    } catch (error) {
      logger.error('[NginxConfigParser] Failed to parse config:', error);
      return null;
    }
  }

  /**
   * 提取 server 块
   */
  private static extractServerBlocks(content: string): string[] {
    const blocks: string[] = [];
    let depth = 0;
    let currentBlock = '';
    let inServerBlock = false;

    // 移除注释
    const lines = content.split('\n').map((line) => {
      const commentIndex = line.indexOf('#');
      return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
    });

    const cleanContent = lines.join('\n');

    for (let i = 0; i < cleanContent.length; i++) {
      const char = cleanContent[i];

      if (cleanContent.substring(i, i + 6) === 'server' && /\s/.test(cleanContent[i + 6])) {
        inServerBlock = true;
        currentBlock = '';
      }

      if (inServerBlock) {
        currentBlock += char;

        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            blocks.push(currentBlock);
            currentBlock = '';
            inServerBlock = false;
          }
        }
      }
    }

    return blocks;
  }

  /**
   * 获取 SSL 证书信息
   */
  private static async getCertificateInfo(certPath: string): Promise<CertificateInfo | null> {
    try {
      // 检查证书文件是否存在
      await fs.access(certPath);

      // 使用 openssl 命令读取证书信息
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(
        `openssl x509 -in "${certPath}" -noout -subject -issuer -dates 2>/dev/null`
      );

      // 解析输出
      const subjectMatch = stdout.match(/subject=(.+)/);
      const issuerMatch = stdout.match(/issuer=(.+)/);
      const notAfterMatch = stdout.match(/notAfter=(.+)/);

      // 提取域名
      const cnMatch = subjectMatch?.[1].match(/CN\s*=\s*([^,]+)/);
      const domain = cnMatch?.[1].trim();

      // 提取过期时间
      const expiryDate = notAfterMatch?.[1].trim();

      // 判断是否即将过期（30天内）
      let expiryWarning = false;
      if (expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        expiryWarning = daysUntilExpiry < 30 && daysUntilExpiry > 0;
      }

      return {
        path: certPath,
        domain: domain || undefined,
        issuer: issuerMatch?.[1].trim(),
        expiryDate: expiryDate || undefined,
        expiryWarning,
      };
    } catch (error) {
      logger.debug(`[NginxConfigParser] Failed to read certificate ${certPath}:`, error);
      return null;
    }
  }

  /**
   * 解析 include 指令并递归读取配置
   */
  static async parseWithIncludes(mainConfigPath: string): Promise<NginxConfigInfo | null> {
    try {
      const mainConfig = await this.parse(mainConfigPath);
      if (!mainConfig) return null;

      // 读取主配置文件以查找 include 指令
      const content = await fs.readFile(mainConfigPath, 'utf-8');
      const includeMatches = content.matchAll(/include\s+([^;]+);/g);

      const configDir = path.dirname(mainConfigPath);

      for (const match of includeMatches) {
        const includePath = match[1].trim();
        const fullPath = path.isAbsolute(includePath)
          ? includePath
          : path.join(configDir, includePath);

        // 处理通配符
        if (includePath.includes('*')) {
          // 简化处理：只处理常见的 sites-enabled/* 和 conf.d/* 模式
          const dir = path.dirname(fullPath);
          try {
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (file.endsWith('.conf') || !file.includes('.')) {
                const filePath = path.join(dir, file);
                const includedConfig = await this.parse(filePath);
                if (includedConfig) {
                  mainConfig.domains.push(...includedConfig.domains);
                  mainConfig.ports.push(...includedConfig.ports);
                  mainConfig.protocols.push(...includedConfig.protocols);
                  mainConfig.sslCertificates.push(...includedConfig.sslCertificates);
                  mainConfig.sslEnabled = mainConfig.sslEnabled || includedConfig.sslEnabled;
                }
              }
            }
          } catch {
            // 目录不存在或无法读取，跳过
          }
        } else {
          // 单个文件
          try {
            const includedConfig = await this.parse(fullPath);
            if (includedConfig) {
              mainConfig.domains.push(...includedConfig.domains);
              mainConfig.ports.push(...includedConfig.ports);
              mainConfig.protocols.push(...includedConfig.protocols);
              mainConfig.sslCertificates.push(...includedConfig.sslCertificates);
              mainConfig.sslEnabled = mainConfig.sslEnabled || includedConfig.sslEnabled;
            }
          } catch {
            // 文件不存在或无法读取，跳过
          }
        }
      }

      // 去重
      mainConfig.domains = [...new Set(mainConfig.domains)];
      mainConfig.ports = [...new Set(mainConfig.ports)];
      mainConfig.protocols = [...new Set(mainConfig.protocols)];

      return mainConfig;
    } catch (error) {
      logger.error('[NginxConfigParser] Failed to parse with includes:', error);
      return null;
    }
  }
}

export interface NginxConfigInfo {
  domains: string[]; // 域名列表
  ports: number[]; // 监听端口列表
  protocols: string[]; // 协议列表 (http, https)
  sslEnabled: boolean; // 是否启用 SSL
  sslCertificates: CertificateInfo[]; // SSL 证书信息
}

export interface CertificateInfo {
  path: string; // 证书路径
  domain?: string; // 证书域名
  issuer?: string; // 签发者
  expiryDate?: string; // 过期日期
  expiryWarning: boolean; // 是否即将过期（30天内）
}
