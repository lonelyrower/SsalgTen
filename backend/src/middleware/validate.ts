import { ZodObject, ZodRawShape, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

export const validateBody =
  (schema: ZodObject<ZodRawShape>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      const issues =
        err instanceof ZodError
          ? err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            }))
          : [];
      res.status(400).json({
        success: false,
        error: "Invalid request body",
        data: { issues },
      });
    }
  };
