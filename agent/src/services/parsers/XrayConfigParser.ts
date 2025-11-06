import fs from 'fs/promises';
import { logger } from '../../utils/logger';

/**
 * Xray 配置解析器
 * 从 Xray 配置文件中提取协议、端口、域名等信息
 */
export class XrayConfigParser {
  /**
   * 解析 Xray 配置文件
   */
  static async parse(configPath: string): Promise<XrayConfigInfo | null> {
    try {
      logger.debug(`[XrayConfigParser] Reading config from: ${configPath}`);
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      const inbounds = config.inbounds || [];
      logger.debug(`[XrayConfigParser] Found ${inbounds.length} inbounds`);

      const protocols: string[] = [];
      const ports: number[] = [];
      const domains: string[] = [];
      const shareLinks: string[] = [];

      // 遍历所有 inbound
      for (const inbound of inbounds) {
        if (!inbound) continue;

        // 收集协议
        if (inbound.protocol) {
          protocols.push(inbound.protocol);
        }

        // 收集端口
        if (inbound.port) {
          ports.push(inbound.port);
        }

        // 收集域名（从 streamSettings 中）
        const streamSettings = inbound.streamSettings;
        if (streamSettings) {
          // TLS/XTLS 域名
          if (streamSettings.tlsSettings?.serverName) {
            domains.push(streamSettings.tlsSettings.serverName);
          }
          if (streamSettings.xtlsSettings?.serverName) {
            domains.push(streamSettings.xtlsSettings.serverName);
          }

          // WebSocket/H2/gRPC 域名
          if (streamSettings.wsSettings?.headers?.Host) {
            const host = streamSettings.wsSettings.headers.Host;
            if (typeof host === 'string') {
              domains.push(host);
            }
          }
          if (streamSettings.httpSettings?.host) {
            const hosts = streamSettings.httpSettings.host;
            if (Array.isArray(hosts)) {
              domains.push(...hosts);
            }
          }
          const xhttpHost = streamSettings.xhttpSettings?.host ?? streamSettings.splithttpSettings?.host;
          if (xhttpHost) {
            const hostList = Array.isArray(xhttpHost) ? xhttpHost : [xhttpHost];
            for (const item of hostList) {
              if (typeof item === 'string' && item.trim().length > 0) {
                domains.push(item.trim());
              }
            }
          }
          if (streamSettings.grpcSettings?.serviceName) {
            // gRPC 通常也需要域名，可能在其他地方配置
          }
        }

        // 尝试生成分享链接
        try {
          const shareLink = this.generateShareLink(inbound);
          if (shareLink) {
            shareLinks.push(shareLink);
          }
        } catch (error) {
          logger.debug('[XrayConfigParser] Failed to generate share link:', error);
        }
      }

      return {
        protocols: [...new Set(protocols)],
        ports: [...new Set(ports)],
        domains: [...new Set(domains)],
        shareLinks,
      };
    } catch (error) {
      logger.error('[XrayConfigParser] Failed to parse config:', error);
      return null;
    }
  }

  /**
   * 生成分享链接
   */
  private static generateShareLink(inbound: any): string | null {
    const protocol = inbound.protocol;
    const port = inbound.port;

    if (!protocol || !port) return null;

    // 简化版本：只支持常见协议的基本链接生成
    // 实际应用中需要更复杂的逻辑来处理各种配置

    if (protocol === 'vmess') {
      return this.generateVMessLink(inbound);
    } else if (protocol === 'vless') {
      return this.generateVLESSLink(inbound);
    } else if (protocol === 'trojan') {
      return this.generateTrojanLink(inbound);
    } else if (protocol === 'shadowsocks') {
      return this.generateShadowsocksLink(inbound);
    } else if (protocol === 'socks' || protocol === 'http') {
      return this.generateSocksHttpLink(inbound);
    }

    return null;
  }

  /**
   * 生成 VMess 分享链接
   * 支持完整的传输层和 TLS 配置
   */
  private static generateVMessLink(inbound: any): string | null {
    try {
      const settings = inbound.settings || {};
      const clients = settings.clients || [];
      if (clients.length === 0) return null;

      const client = clients[0];
      // 支持 233boy 格式：配置可能直接在 inbound 对象中
      const streamSettings = inbound.streamSettings || {};
      const network = streamSettings.network || inbound.network || 'tcp';
      const security = streamSettings.security || inbound.security || 'none';

      const vmessConfig: any = {
        v: '2',
        ps: inbound.tag || 'Xray Server',
        add: 'YOUR_SERVER_IP',
        port: inbound.port,
        id: client.id,
        aid: client.alterId || 0,
        net: network,
        type: 'none',
        host: '',
        path: '',
        tls: security,
      };

      // TLS 配置（支持 233boy 格式）
      if (security === 'tls') {
        const tlsSettings = streamSettings.tlsSettings || inbound.tlsSettings || {};

        if (tlsSettings.serverName) {
          vmessConfig.sni = tlsSettings.serverName;
        }

        if (tlsSettings.fingerprint) {
          vmessConfig.fp = tlsSettings.fingerprint;
        }

        if (tlsSettings.alpn && Array.isArray(tlsSettings.alpn)) {
          vmessConfig.alpn = tlsSettings.alpn.join(',');
        }
      }

      // WebSocket 配置（支持 233boy 格式）
      if (network === 'ws') {
        const wsSettings = streamSettings.wsSettings || inbound.wsSettings;
        if (wsSettings) {
          vmessConfig.path = wsSettings.path || '/';
          vmessConfig.host = wsSettings.headers?.Host || '';
        }
      }

      // HTTP/2 配置（支持 233boy 格式）
      if (network === 'h2') {
        const httpSettings = streamSettings.httpSettings || inbound.httpSettings;
        if (httpSettings) {
          vmessConfig.path = httpSettings.path || '/';
          vmessConfig.host = Array.isArray(httpSettings.host)
            ? httpSettings.host.join(',')
            : httpSettings.host || '';
        }
      }

      // XHTTP/SplitHTTP 配置（支持 233boy 格式）
      if (network === 'xhttp' || network === 'splithttp') {
        const xhttpSettings =
          streamSettings.xhttpSettings ??
          streamSettings.splithttpSettings ??
          inbound.xhttpSettings ??
          inbound.splithttpSettings;
        if (xhttpSettings) {
          if (typeof xhttpSettings.path === 'string' && xhttpSettings.path.trim()) {
            vmessConfig.path = xhttpSettings.path;
          }
          if (typeof xhttpSettings.host === 'string' && xhttpSettings.host.trim()) {
            vmessConfig.host = xhttpSettings.host;
          }
        }
      }

      // gRPC 配置（支持 233boy 格式）
      if (network === 'grpc') {
        const grpcSettings = streamSettings.grpcSettings || inbound.grpcSettings;
        if (grpcSettings) {
          vmessConfig.path = grpcSettings.serviceName || '';
          vmessConfig.type = grpcSettings.multiMode ? 'multi' : 'gun';
        }
      }

      // TCP 配置（支持 233boy 格式）
      if (network === 'tcp') {
        const tcpSettings = streamSettings.tcpSettings || inbound.tcpSettings;
        if (tcpSettings && tcpSettings.header?.type === 'http') {
          vmessConfig.type = 'http';
          const request = tcpSettings.header.request || {};

          if (request.path && Array.isArray(request.path)) {
            vmessConfig.path = request.path.join(',');
          }

          if (request.headers?.Host && Array.isArray(request.headers.Host)) {
            vmessConfig.host = request.headers.Host.join(',');
          }
        }
      }

      // KCP 配置（支持 233boy 格式）
      if (network === 'kcp') {
        const kcpSettings = streamSettings.kcpSettings || inbound.kcpSettings;
        if (kcpSettings) {
          if (kcpSettings.header?.type) {
            vmessConfig.type = kcpSettings.header.type;
          }

          if (kcpSettings.seed) {
            vmessConfig.path = kcpSettings.seed;
          }
        }
      }

      // QUIC 配置（支持 233boy 格式）
      if (network === 'quic') {
        const quicSettings = streamSettings.quicSettings || inbound.quicSettings;
        if (quicSettings) {
          if (quicSettings.security) {
            vmessConfig.host = quicSettings.security;
          }

          if (quicSettings.key) {
            vmessConfig.path = quicSettings.key;
          }

          if (quicSettings.header?.type) {
            vmessConfig.type = quicSettings.header.type;
          }
        }
      }

      const jsonStr = JSON.stringify(vmessConfig);
      const base64 = Buffer.from(jsonStr).toString('base64');
      return `vmess://${base64}`;
    } catch {
      return null;
    }
  }

  /**
   * 生成 VLESS 分享链接
   * 完整支持 flow、SNI、fingerprint、publicKey、alpn 等参数
   */
  private static generateVLESSLink(inbound: any): string | null {
    try {
      const settings = inbound.settings || {};
      const clients = settings.clients || [];
      if (clients.length === 0) return null;

      const client = clients[0];

      // 233boy 的配置格式：security/realitySettings 等字段直接在 inbound 对象中
      // 标准格式：这些字段在 streamSettings 中
      // 我们需要同时支持两种格式
      const streamSettings = inbound.streamSettings || {};
      const network = streamSettings.network || inbound.network || 'tcp';
      const security = streamSettings.security || inbound.security || 'none';

      // TLS/XTLS/REALITY 设置可能在 streamSettings 或 inbound 顶层
      const tlsSettings = streamSettings.tlsSettings || inbound.tlsSettings || {};
      const xtlsSettings = streamSettings.xtlsSettings || inbound.xtlsSettings || {};
      const realitySettings = streamSettings.realitySettings || inbound.realitySettings || {};

      const params: string[] = [];
      const addedKeys = new Set<string>();
      const pushParam = (key: string, value: unknown) =>
        this.pushParam(params, addedKeys, key, value);

      pushParam('encryption', client.encryption || 'none');
      pushParam('type', network);
      pushParam('security', security);
      pushParam('flow', client.flow);

      const sniCandidate = this.firstString(
        tlsSettings.serverName,
        tlsSettings.server,
        tlsSettings.servername,
        tlsSettings.serverNames,
        tlsSettings.domains,
        xtlsSettings.serverName,
        xtlsSettings.server,
        xtlsSettings.servername,
        xtlsSettings.serverNames,
        xtlsSettings.domains,
        streamSettings.serverName,
        streamSettings.server,
        streamSettings.sni,
        streamSettings.host,
        streamSettings.wsSettings?.headers?.Host,
        streamSettings.httpSettings?.host,
        realitySettings.serverName,
        realitySettings.serverNames,
      );

      if (security === 'tls' || security === 'xtls') {
        pushParam('sni', sniCandidate);
        pushParam(
          'fp',
          this.firstString(
            tlsSettings.fingerprint,
            xtlsSettings.fingerprint,
            streamSettings.fingerprint,
          ),
        );
        pushParam('alpn', tlsSettings.alpn ?? xtlsSettings.alpn);
        pushParam('pbk', this.firstString(tlsSettings.publicKey, xtlsSettings.publicKey));
        pushParam(
          'sid',
          this.firstString(
            tlsSettings.shortId,
            tlsSettings.shortIds,
            xtlsSettings.shortId,
            xtlsSettings.shortIds,
          ),
        );
        pushParam('spx', this.firstString(tlsSettings.spiderX, xtlsSettings.spiderX));
      }

      if (security === 'reality') {
        pushParam('sni', sniCandidate || this.firstString(realitySettings.serverName, realitySettings.serverNames));
        pushParam('pbk', realitySettings.publicKey);
        pushParam('sid', this.firstString(realitySettings.shortId, realitySettings.shortIds));
        pushParam('spx', realitySettings.spiderX);
        pushParam(
          'fp',
          this.firstString(
            realitySettings.fingerprint,
            streamSettings.fingerprint,
            tlsSettings.fingerprint,
            xtlsSettings.fingerprint,
          ),
        );
        pushParam('alpn', realitySettings.alpn);
      }

      // 233boy 配置格式：传输配置可能直接在 inbound 对象中
      if (network === 'ws') {
        const wsSettings = streamSettings.wsSettings || inbound.wsSettings;
        if (wsSettings) {
          pushParam('path', wsSettings.path);
          pushParam('host', wsSettings.headers?.Host);
        }
      }

      if (network === 'h2') {
        const httpSettings = streamSettings.httpSettings || inbound.httpSettings;
        if (httpSettings) {
          pushParam('path', httpSettings.path);
          pushParam('host', httpSettings.host);
        }
      }

      if (network === 'xhttp' || network === 'splithttp') {
        const xhttpSettings =
          streamSettings.xhttpSettings ??
          streamSettings.splithttpSettings ??
          inbound.xhttpSettings ??
          inbound.splithttpSettings;
        if (xhttpSettings) {
          pushParam('path', xhttpSettings.path);
          pushParam('host', xhttpSettings.host);
        }
      }

      if (network === 'grpc') {
        const grpcSettings = streamSettings.grpcSettings || inbound.grpcSettings;
        if (grpcSettings) {
          pushParam('serviceName', grpcSettings.serviceName);
          if (typeof grpcSettings.multiMode === 'boolean') {
            pushParam('mode', grpcSettings.multiMode ? 'multi' : 'gun');
          }
        }
      }

      if (network === 'tcp') {
        const tcpSettings = streamSettings.tcpSettings || inbound.tcpSettings;
        if (tcpSettings && tcpSettings.header?.type === 'http') {
          pushParam('headerType', 'http');
          const request = tcpSettings.header.request || {};
          pushParam('path', request.path);
          pushParam('host', request.headers?.Host);
        }
      }

      if (network === 'quic') {
        const quicSettings = streamSettings.quicSettings || inbound.quicSettings;
        if (quicSettings) {
          pushParam('quicSecurity', quicSettings.security);
          pushParam('key', quicSettings.key);
          pushParam('headerType', quicSettings.header?.type);
        }
      }

      if (network === 'kcp') {
        const kcpSettings = streamSettings.kcpSettings || inbound.kcpSettings;
        if (kcpSettings) {
          pushParam('seed', kcpSettings.seed);
          pushParam('headerType', kcpSettings.header?.type);
        }
      }

      let link = `vless://${client.id}@YOUR_SERVER_IP:${inbound.port}`;
      if (params.length > 0) {
        link += `?${params.join('&')}`;
      }
      link += `#${encodeURIComponent(inbound.tag || 'Xray Server')}`;

      return link;
    } catch {
      return null;
    }
  }
  /**
   * 生成 Trojan 分享链接
   * 支持完整的传输层和 TLS 配置
   */
  private static generateTrojanLink(inbound: any): string | null {
    try {
      const settings = inbound.settings || {};
      const clients = settings.clients || [];
      if (clients.length === 0) return null;

      const client = clients[0];
      const password = client.password;
      if (!password) return null;

      // 支持 233boy 格式：配置可能直接在 inbound 对象中
      const streamSettings = inbound.streamSettings || {};
      const network = streamSettings.network || inbound.network || 'tcp';
      const security = streamSettings.security || inbound.security || 'tls';

      const params: string[] = [];
      const addedKeys = new Set<string>();
      const pushParam = (key: string, value: unknown) =>
        this.pushParam(params, addedKeys, key, value);

      pushParam('type', network);
      pushParam('security', security);

      if (security === 'tls') {
        const tlsSettings = streamSettings.tlsSettings || inbound.tlsSettings || {};
        const sniCandidate = this.firstString(
          tlsSettings.serverName,
          tlsSettings.server,
          tlsSettings.servername,
          tlsSettings.serverNames,
          tlsSettings.domains,
          streamSettings.serverName,
          inbound.serverName,
          streamSettings.server,
          streamSettings.sni,
          streamSettings.host,
          streamSettings.wsSettings?.headers?.Host,
          streamSettings.httpSettings?.host,
          inbound.wsSettings?.headers?.Host,
          inbound.httpSettings?.host,
        );
        pushParam('sni', sniCandidate);
        pushParam('fp', this.firstString(tlsSettings.fingerprint, streamSettings.fingerprint));
        pushParam('alpn', tlsSettings.alpn);
      }

      // 支持 233boy 格式：传输配置可能直接在 inbound 对象中
      if (network === 'ws') {
        const wsSettings = streamSettings.wsSettings || inbound.wsSettings;
        if (wsSettings) {
          pushParam('path', wsSettings.path);
          pushParam('host', wsSettings.headers?.Host);
        }
      }

      if (network === 'grpc') {
        const grpcSettings = streamSettings.grpcSettings || inbound.grpcSettings;
        if (grpcSettings) {
          pushParam('serviceName', grpcSettings.serviceName);
          if (typeof grpcSettings.multiMode === 'boolean') {
            pushParam('mode', grpcSettings.multiMode ? 'multi' : 'gun');
          }
        }
      }

      if (network === 'h2') {
        const httpSettings = streamSettings.httpSettings || inbound.httpSettings;
        if (httpSettings) {
          pushParam('path', httpSettings.path);
          pushParam('host', httpSettings.host);
        }
      }

      if (network === 'xhttp' || network === 'splithttp') {
        const xhttpSettings =
          streamSettings.xhttpSettings ??
          streamSettings.splithttpSettings ??
          inbound.xhttpSettings ??
          inbound.splithttpSettings;
        if (xhttpSettings) {
          pushParam('path', xhttpSettings.path);
          pushParam('host', xhttpSettings.host);
        }
      }

      if (network === 'tcp') {
        const tcpSettings = streamSettings.tcpSettings || inbound.tcpSettings;
        if (tcpSettings && tcpSettings.header?.type === 'http') {
          pushParam('headerType', 'http');
          const request = tcpSettings.header.request || {};
          pushParam('path', request.path);
          pushParam('host', request.headers?.Host);
        }
      }

      let link = `trojan://${encodeURIComponent(password)}@YOUR_SERVER_IP:${inbound.port}`;
      if (params.length > 0) {
        link += `?${params.join('&')}`;
      }
      link += `#${encodeURIComponent(inbound.tag || 'Xray Server')}`;

      return link;
    } catch {
      return null;
    }
  }

  private static pushParam(params: string[], addedKeys: Set<string>, key: string, value: unknown): void {
    const normalized = this.normalizeParamValue(value);
    if (!normalized || addedKeys.has(key)) {
      return;
    }
    params.push(`${key}=${encodeURIComponent(normalized)}`);
    addedKeys.add(key);
  }

  private static normalizeParamValue(value: unknown): string | undefined {
    const parts = this.toStringList(value);
    if (parts.length === 0) {
      return undefined;
    }
    return parts.join(',');
  }

  private static toStringList(value: unknown): string[] {
    if (value === null || value === undefined) {
      return [];
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return [value.toString()];
    }
    if (typeof value === 'boolean') {
      return [value ? 'true' : 'false'];
    }
    if (Array.isArray(value)) {
      const result: string[] = [];
      for (const item of value) {
        result.push(...this.toStringList(item));
      }
      return result;
    }
    return [];
  }

  private static firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      const [first] = this.toStringList(value);
      if (first) {
        return first;
      }
    }
    return undefined;
  }

  /**
   * 生成 Shadowsocks 分享链接
   */
  private static generateShadowsocksLink(inbound: any): string | null {
    try {
      const settings = inbound.settings || {};
      const method = settings.method;
      const password = settings.password;

      if (!method || !password) return null;

      const userInfo = `${method}:${password}`;
      const base64UserInfo = Buffer.from(userInfo).toString('base64');

      return `ss://${base64UserInfo}@YOUR_SERVER_IP:${inbound.port}#${encodeURIComponent(inbound.tag || 'Xray Server')}`;
    } catch {
      return null;
    }
  }

  /**
   * 生成 SOCKS/HTTP 代理链接
   * SOCKS 格式: socks://base64(username:password)@host:port#label (233boy 格式)
   * HTTP 格式: http://host:port#label (通常不生成，因为是本地监听)
   */
  private static generateSocksHttpLink(inbound: any): string | null {
    try {
      const protocol = inbound.protocol; // 'socks' or 'http'
      const port = inbound.port;
      const settings = inbound.settings || {};

      // HTTP 代理通常监听在 127.0.0.1，不生成分享链接
      if (protocol === 'http') {
        return null;
      }

      // SOCKS 可能需要认证
      const accounts = settings.accounts || [];
      const auth = settings.auth; // 'password' or 'noauth'

      let link = '';

      if (accounts.length > 0 && auth === 'password') {
        // 有认证 - 使用 233boy 格式：base64 编码的用户名:密码
        const account = accounts[0];
        const username = account.user || account.username;
        const password = account.pass || account.password;

        if (username && password) {
          const userInfo = `${username}:${password}`;
          const base64UserInfo = Buffer.from(userInfo).toString('base64');
          link = `${protocol}://${base64UserInfo}@YOUR_SERVER_IP:${port}`;
        } else {
          // 没有完整的认证信息，不生成链接
          return null;
        }
      } else {
        // 无认证的 SOCKS
        link = `${protocol}://YOUR_SERVER_IP:${port}`;
      }

      // 添加备注
      const tag = inbound.tag || `${protocol.toUpperCase()} Proxy`;
      link += `#${encodeURIComponent(tag)}`;

      return link;
    } catch {
      return null;
    }
  }
}

export interface XrayConfigInfo {
  protocols: string[]; // 协议列表 (vmess, vless, trojan, etc.)
  ports: number[]; // 监听端口列表
  domains: string[]; // 域名列表
  shareLinks: string[]; // 分享链接（需要替换服务器 IP）
}
