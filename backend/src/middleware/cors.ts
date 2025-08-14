import cors from 'cors';

// 解析多个CORS来源
const getCorsOrigins = (): string | string[] => {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    return 'http://localhost:3000';
  }
  
  // 如果包含逗号，分割成数组
  if (corsOrigin.includes(',')) {
    return corsOrigin.split(',').map(origin => origin.trim());
  }
  
  return corsOrigin;
};

const corsOptions: cors.CorsOptions = {
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  optionsSuccessStatus: 200, // IE11支持
};

export const corsMiddleware = cors(corsOptions);