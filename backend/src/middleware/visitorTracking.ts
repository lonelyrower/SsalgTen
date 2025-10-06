import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { ipInfoService } from "../services/IPInfoService";
import { logger } from "../utils/logger";

/**
 * 访问记录中间件
 * 自动记录所有访问者信息到数据库
 */
export async function visitorTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 异步记录访问信息，不阻塞请求
  setImmediate(async () => {
    try {
      // 只记录访问前台的请求，排除后台管理、API、静态资源等
      const excludePaths = [
        "/health",
        "/favicon.ico",
        "/robots.txt",
        "/api/", // 排除所有 API 请求（包括 Agent、管理后台等）
        "/config.js",
      ];

      const shouldSkip =
        excludePaths.some((path) => req.path.startsWith(path)) ||
        req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);

      if (shouldSkip) {
        return;
      }

      // 获取访问者IP信息
      const visitorInfo = await ipInfoService.getVisitorInfo(req);

      // 解析经纬度
      const [lat, lng] = (visitorInfo.loc || "0,0").split(",").map(parseFloat);

      // 记录到数据库
      await prisma.visitorLog.create({
        data: {
          ip: visitorInfo.ip,
          userAgent: visitorInfo.userAgent,
          city: visitorInfo.city,
          region: visitorInfo.region,
          country: visitorInfo.country,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          timezone: visitorInfo.timezone,
          asnNumber: visitorInfo.asn?.asn,
          asnName: visitorInfo.asn?.name,
          asnOrg: visitorInfo.asn?.org,
          company: visitorInfo.company?.name,
          endpoint: req.originalUrl,
          method: req.method,
          referer: req.headers.referer,
        },
      });
    } catch (error) {
      // 记录失败不影响主流程
      logger.debug("Failed to log visitor info:", error);
    }
  });

  next();
}
