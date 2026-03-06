import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './utils/logger';
import { config, serverConfig, serviceDetectionConfig } from './config';
import { diagnosticController } from './controllers/DiagnosticController';
import { registrationService } from './services/RegistrationService';
import { streamingTestService } from './services/StreamingTestService';
import { serviceDetectionService } from './services/ServiceDetectionService';
import { verifySignedControlRequest } from './utils/signing';

const execAsync = promisify(exec);

// 加载环境变量
dotenv.config();

/**
 * 检查 Docker 访问权限
 * 如果 Docker 可用但无权限，提供解决方案
 */
async function checkDockerAccess(): Promise<void> {
  try {
    await execAsync('docker --version');
    // Docker 已安装，尝试执行 docker ps
    try {
      await execAsync('docker ps');
      logger.info('✅ Docker access verified - container detection enabled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('permission denied') || errorMessage.includes('EACCES')) {
        logger.warn('═'.repeat(80));
        logger.warn('⚠️  DOCKER PERMISSION ISSUE DETECTED');
        logger.warn('═'.repeat(80));
        logger.warn('Docker is installed but the agent cannot access the Docker socket.');
        logger.warn('This will prevent container detection and NPM domain extraction.');
        logger.warn('');
        logger.warn('🔧 SOLUTIONS:');
        logger.warn('');
        logger.warn('Option 1 (Docker Container - Recommended):');
        logger.warn('  Add Docker socket volume mount when running the agent container:');
        logger.warn('  docker run -v /var/run/docker.sock:/var/run/docker.sock ...');
        logger.warn('');
        logger.warn('  Or in docker-compose.yml:');
        logger.warn('  volumes:');
        logger.warn('    - /var/run/docker.sock:/var/run/docker.sock:ro');
        logger.warn('');
        logger.warn('Option 2 (Host Installation):');
        logger.warn('  Add the agent user to the docker group:');
        logger.warn('  sudo usermod -aG docker $(whoami)');
        logger.warn('  Then logout and login again, or restart the agent service.');
        logger.warn('');
        logger.warn('═'.repeat(80));
      } else {
        logger.warn(`⚠️  Docker installed but not accessible: ${errorMessage}`);
        logger.warn('Container detection will be disabled.');
      }
    }
  } catch {
    // Docker 未安装，这是正常情况
    logger.info('ℹ️  Docker not installed - container detection disabled');
  }
}

const app = express();
app.disable('x-powered-by');

const isProduction = serverConfig.nodeEnv === 'production';

const isUnsafeAgentApiKey = (key: string): boolean => {
  const unsafeKeys = new Set([
    'default-api-key',
    'default-agent-api-key',
    'default-agent-key-change-this',
    'default-agent-key-change-this-immediately',
    'default-agent-api-key-change-this-in-production',
    'change-this-api-key',
    'changeme',
  ]);
  return unsafeKeys.has(key);
};

const isValidAgentApiKeyFormat = (key: string): boolean => {
  if (key.startsWith('ssalgten_')) {
    // ssalgten_ + timestamp + hex
    return key.length >= 48;
  }
  // Back-compat: allow older opaque keys, but require minimum length
  return key.length >= 16;
};

// Allow insecure TLS for outbound requests when explicitly enabled.
// Temporary workaround for environments with incomplete cert chains.
if ((process.env.AGENT_TLS_INSECURE || '').toLowerCase() === 'true' || process.env.AGENT_TLS_INSECURE === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  logger.warn('AGENT_TLS_INSECURE is enabled; TLS certificate verification is disabled for outbound requests');
}

// 启动前安全检查：禁止使用默认API Key
const expectedApiKey = (config.apiKey || '').trim();
if (!expectedApiKey || isUnsafeAgentApiKey(expectedApiKey) || !isValidAgentApiKeyFormat(expectedApiKey)) {
  logger.error('AGENT_API_KEY 未设置或仍为不安全/无效的值，请设置一个安全的随机密钥后再启动 (env AGENT_API_KEY)');
  logger.error('建议使用后端生成的 system API key（形如 ssalgten_<...>），并确保所有 Agent 使用同一密钥。');
  process.exit(1);
}
if (!expectedApiKey.startsWith('ssalgten_')) {
  logger.warn('AGENT_API_KEY 未使用推荐的 ssalgten_* 格式（仍允许启动，但建议尽快更换为更强的随机密钥）');
}

// CORS (agent 通常不需要被浏览器直接调用；生产环境默认禁用 CORS)
const parseCorsOrigins = (raw: string): string[] => {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

const corsOriginRaw = (process.env.AGENT_CORS_ORIGIN || '').trim();
if (corsOriginRaw) {
  const allowed = Array.from(new Set(parseCorsOrigins(corsOriginRaw)));
  app.use(cors({ origin: allowed, credentials: true }));
} else if (!isProduction) {
  app.use(cors());
} else {
  app.use(cors({ origin: false }));
}

// Simple in-memory protections for agent control endpoints
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.AGENT_RATE_LIMIT_WINDOW_MS || '60000'); // 1 min
const RATE_LIMIT_MAX = parseInt(process.env.AGENT_RATE_LIMIT_MAX || '60');
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map();

const getClientKey = (req: Request): string => {
  return String(req.ip || req.socket.remoteAddress || 'unknown');
};

const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = getClientKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }
  bucket.count += 1;
  // Opportunistic cleanup to avoid unbounded growth
  if (rateBuckets.size > 10000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  next();
};

let inFlight = 0;
const concurrencyLimit = Math.max(1, Number(serverConfig.maxConcurrentTests) || 5);
const concurrencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (inFlight >= concurrencyLimit) {
    res.status(429).json({ success: false, error: 'Too many concurrent tests' });
    return;
  }
  inFlight += 1;
  let done = false;
  const dec = () => {
    if (done) return;
    done = true;
    inFlight = Math.max(0, inFlight - 1);
  };
  res.on('finish', dec);
  res.on('close', dec);
  next();
};

const readApiKey = (req: Request): string => {
  const hdr =
    (req.headers['x-agent-api-key'] as string) ||
    (req.headers['x-api-key'] as string) ||
    (req.headers['authorization'] as string) ||
    '';
  if (!hdr) return '';
  const trimmed = String(hdr).trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) return trimmed.slice(7).trim();
  return trimmed;
};

const allowHeaderAuthFallback =
  (process.env.AGENT_ALLOW_HEADER_AUTH_FALLBACK || '').toLowerCase() === 'true';

const requireAgentApiKey = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = (req.headers['x-timestamp'] as string) || undefined;
  const nonce = (req.headers['x-nonce'] as string) || undefined;
  const signature = (req.headers['x-signature'] as string) || undefined;
  const signCheck = verifySignedControlRequest({
    apiKey: expectedApiKey,
    method: req.method,
    requestPath: req.originalUrl || req.url,
    body: req.body,
    timestamp,
    nonce,
    signature,
  });

  if (signCheck.ok) {
    next();
    return;
  }

  if (allowHeaderAuthFallback) {
    const provided = readApiKey(req);
    if (provided && provided === expectedApiKey) {
      logger.warn(
        `[agent-auth] Allowing deprecated header auth fallback for ${req.method} ${req.originalUrl}`,
      );
      next();
      return;
    }
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    reason: signCheck.reason || 'missing_signature',
  });
};

// 中间件配置
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 基础路由
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'running',
    service: 'SsalgTen Agent',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const buildHealthPayload = () => ({
  success: true,
  status: 'healthy',
  service: 'SsalgTen Agent',
  version: '0.1.0',
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
});

// 健康检查
app.get('/health', (req: Request, res: Response) => {
  res.json(buildHealthPayload());
});

// 兼容旧的健康检查路径（部分编排使用 /api/health）
app.get('/api/health', (req: Request, res: Response) => {
  res.json(buildHealthPayload());
});
// Protect all remaining /api endpoints (except /api/health defined above)
app.use('/api', requireAgentApiKey, rateLimitMiddleware, concurrencyMiddleware);

// Agent 信息
app.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'SsalgTen Agent',
      version: '0.1.0',
      api: {
        health: '/health',
        legacyHealth: '/api/health',
        protectedBase: '/api/*'
      },
      capabilities: [
        'ping',
        'traceroute',
        'mtr',
        'speedtest',
        'latency-test',
        'system-monitoring'
      ]
    }
  });
});

// 网络诊断 API 路由
app.get('/api/ping/:target', diagnosticController.ping.bind(diagnosticController));
app.get('/api/traceroute/:target', diagnosticController.traceroute.bind(diagnosticController));
app.get('/api/mtr/:target', diagnosticController.mtr.bind(diagnosticController));
app.get('/api/speedtest', diagnosticController.speedtest.bind(diagnosticController));
app.get('/api/latency-test', diagnosticController.latencyTest.bind(diagnosticController));
app.get('/api/network-info', diagnosticController.networkInfo.bind(diagnosticController));
app.get('/api/connectivity', diagnosticController.connectivity.bind(diagnosticController));

// 手动触发流媒体检测
app.post('/api/streaming/test', async (req: Request, res: Response) => {
  const result = await streamingTestService.triggerManual();
  if (!result.started) {
    res.status(409).json({
      success: false,
      error:
        result.reason === 'in_progress'
          ? 'Streaming detection already in progress'
          : 'Unable to start detection',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Streaming detection started',
  });
});

// 手动触发服务扫描
app.post('/api/services/scan', async (req: Request, res: Response) => {
  const result = await serviceDetectionService.triggerManual();
  if (!result.started) {
    res.status(409).json({
      success: false,
      error:
        result.reason === 'in_progress'
          ? 'Service scan already in progress'
          : 'Unable to start scan',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Service scan started',
  });
});

// 404 处理（Express 5 / router@2 不再支持 '*' 路由通配符）
// 放在最后：不指定路径即可捕获所有未匹配的请求
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /info',
      'GET /api/ping/:target',
      'GET /api/traceroute/:target',
      'GET /api/mtr/:target',
      'GET /api/speedtest',
      'GET /api/latency-test',
      'GET /api/network-info',
      'GET /api/connectivity'
    ]
  });
});

// 全局错误处理
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(serverConfig.nodeEnv === 'development' && { 
      details: error.message 
    })
  });
});

// 启动服务器
const server = app.listen(serverConfig.port, async () => {
  logger.info(`🤖 SsalgTen Agent started successfully`);
  logger.info(`📡 Agent ID: ${config.id}`);
  logger.info(`🏷️  Node Name: ${config.name}`);
  logger.info(`📍 Location: ${config.location.city}, ${config.location.country}`);
  logger.info(`🏢 Provider: ${config.provider}`);
  logger.info(`🌐 Server: http://localhost:${serverConfig.port}`);
  logger.info(`🔗 Master: ${config.masterUrl}`);
  logger.info(`⚡ Environment: ${serverConfig.nodeEnv}`);

  // 检查 Docker 访问权限
  await checkDockerAccess();

  // 延迟注册以确保服务器完全启动
  setTimeout(async () => {
    logger.info('🔄 Attempting to register with master server...');

    try {
      const result = await registrationService.retryRegistration(3, 5000);

      if (result.success) {
        logger.info(`✅ Registration successful! Node: ${result.nodeName} (${result.location})`);

        // 注册成功后启动流媒体检测服务
        streamingTestService.start();

        // 启动服务检测服务（如果已启用）
        if (serviceDetectionConfig.enabled) {
          serviceDetectionService.start();
          logger.info('🔍 Service detection enabled');
        } else {
          logger.info('🔍 Service detection disabled');
        }
      } else {
        logger.error(`❌ Registration failed: ${result.error}`);
        logger.warn('⚠️  Agent will continue running but will not appear in the master server.');
        logger.warn('📋 Please ensure:');
        logger.warn('   1. Master server is running and accessible');
        logger.warn('   2. This agent is registered in the master server admin panel');
        logger.warn('   3. Network connectivity to the master server');
      }
    } catch (error) {
      logger.error('💥 Unexpected registration error:', error);
    }
  }, 2000);
});

// 优雅关闭
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  // 停止所有服务
  streamingTestService.stop();
  serviceDetectionService.stop();
  await registrationService.shutdown();

  server.close(() => {
    logger.info('🛑 Agent server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));



