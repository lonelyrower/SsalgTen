import crypto from "crypto";
import { prisma } from "../lib/prisma";

const DEFAULT_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || "30",
  10,
);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class RefreshTokenService {
  generateToken(): string {
    return crypto.randomBytes(48).toString("hex");
  }

  async create(
    userId: string,
    ip?: string,
    userAgent?: string,
    days = DEFAULT_EXPIRES_DAYS,
  ) {
    const token = this.generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, ip, userAgent },
    });
    return { token, expiresAt };
  }

  async verify(
    token: string,
  ): Promise<null | { userId: string; tokenHash: string }> {
    const tokenHash = hashToken(token);
    const rec = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!rec) return null;
    if (rec.revoked) return null;
    if (new Date() > rec.expiresAt) return null;
    return { userId: rec.userId, tokenHash };
  }

  async revoke(token: string): Promise<boolean> {
    try {
      const tokenHash = hashToken(token);
      await prisma.refreshToken.update({
        where: { tokenHash },
        data: { revoked: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  async rotate(
    token: string,
    ip?: string,
    userAgent?: string,
    days = DEFAULT_EXPIRES_DAYS,
  ) {
    const v = await this.verify(token);
    if (!v) return null;
    // revoke old
    await prisma.refreshToken.update({
      where: { tokenHash: v.tokenHash },
      data: { revoked: true },
    });
    // create new
    const next = await this.create(v.userId, ip, userAgent, days);
    return { userId: v.userId, ...next };
  }
}

export const refreshTokenService = new RefreshTokenService();
