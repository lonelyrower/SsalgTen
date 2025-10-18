import { Request, Response } from "express";
import { isIP } from "net";
import { ipInfoService } from "../services/IPInfoService";
import { ApiResponse } from "../types";
import { logger } from "../utils/logger";

const domainRegex = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
const isValidLookupTarget = (target: string): boolean =>
  Boolean(target) && (isIP(target) !== 0 || domainRegex.test(target));

class VisitorController {
  async getVisitorInfo(req: Request, res: Response): Promise<void> {
    try {
      const info = await ipInfoService.getVisitorInfo(req);
      const response: ApiResponse = {
        success: true,
        data: info,
      };
      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch visitor info:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch visitor info",
      };
      res.status(500).json(response);
    }
  }

  async getIPInfo(req: Request, res: Response): Promise<void> {
    try {
      const raw = req.params.ip;
      const ip = typeof raw === "string" ? raw.trim() : "";

      if (!ip) {
        const response: ApiResponse = {
          success: false,
          error: "IP is required",
        };
        res.status(400).json(response);
        return;
      }

      if (!isValidLookupTarget(ip)) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid IP or hostname",
        };
        res.status(400).json(response);
        return;
      }

      const info = await ipInfoService.getIPInfo(ip);
      if (!info) {
        const response: ApiResponse = {
          success: false,
          error: "IP information not found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: info,
      };
      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch IP info:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch IP info",
      };
      res.status(500).json(response);
    }
  }
}

export const visitorController = new VisitorController();
