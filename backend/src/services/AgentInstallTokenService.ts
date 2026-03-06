import crypto from "crypto";
import jwt from "jsonwebtoken";

interface InstallTokenPayload {
  purpose: "agent-install";
  jti: string;
  iat?: number;
  exp?: number;
}

class AgentInstallTokenService {
  private readonly ttlSeconds = parseInt(
    process.env.AGENT_INSTALL_TOKEN_TTL_SECONDS || "900",
    10,
  );

  private readonly consumedTokens = new Map<string, number>();

  private getSecret(): string {
    const secret = (
      process.env.AGENT_INSTALL_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      ""
    ).trim();
    if (!secret) {
      throw new Error("AGENT_INSTALL_TOKEN_SECRET or JWT_SECRET must be set");
    }
    return secret;
  }

  issueToken(): { token: string; expiresAt: string } {
    const secret = this.getSecret();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const payload: InstallTokenPayload = {
      purpose: "agent-install",
      jti: crypto.randomUUID(),
    };

    const token = jwt.sign(payload, secret, {
      algorithm: "HS256",
      expiresIn: this.ttlSeconds,
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  consumeToken(token: string):
    | { ok: true; payload: InstallTokenPayload }
    | {
        ok: false;
        reason: string;
      } {
    this.cleanupConsumedTokens();

    try {
      const decoded = jwt.verify(
        token,
        this.getSecret(),
      ) as InstallTokenPayload;
      if (decoded.purpose !== "agent-install" || !decoded.jti) {
        return { ok: false, reason: "invalid_purpose" };
      }

      const alreadyConsumed = this.consumedTokens.get(decoded.jti);
      if (alreadyConsumed && alreadyConsumed > Date.now()) {
        return { ok: false, reason: "token_already_used" };
      }

      const expiresAtMs = decoded.exp ? decoded.exp * 1000 : Date.now();
      this.consumedTokens.set(decoded.jti, expiresAtMs);
      return { ok: true, payload: decoded };
    } catch {
      return { ok: false, reason: "invalid_or_expired_token" };
    }
  }

  private cleanupConsumedTokens(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.consumedTokens.entries()) {
      if (expiresAt <= now) {
        this.consumedTokens.delete(jti);
      }
    }
  }
}

export const agentInstallTokenService = new AgentInstallTokenService();
