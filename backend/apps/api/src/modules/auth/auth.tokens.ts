import { createHash, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

import { AppError } from "../../core/errors.js";
import type { AppEnv } from "../../config/env.js";
import type { AccessIdentity, AuthUser, UserRole } from "./auth.types.js";

interface TokenPayload {
  sub: string;
  sid: string;
  role: UserRole;
  tokenType: "access" | "refresh";
}

export class AuthTokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;

  constructor(private readonly env: AppEnv) {
    this.accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    this.refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  }

  createSessionId(): string {
    return randomUUID();
  }

  async signAccessToken(user: AuthUser, sessionId: string): Promise<string> {
    return this.sign(
      { sub: user.id, sid: sessionId, role: user.role, tokenType: "access" },
      this.accessSecret,
      this.env.JWT_ACCESS_TTL_SECONDS,
    );
  }

  async signRefreshToken(user: AuthUser, sessionId: string): Promise<string> {
    return this.sign(
      { sub: user.id, sid: sessionId, role: user.role, tokenType: "refresh" },
      this.refreshSecret,
      this.env.JWT_REFRESH_TTL_SECONDS,
    );
  }

  async verifyAccessToken(token: string): Promise<AccessIdentity> {
    const payload = await this.verify(token, this.accessSecret, "access");
    return { userId: payload.sub, sessionId: payload.sid, role: payload.role };
  }

  async verifyRefreshToken(token: string): Promise<AccessIdentity> {
    const payload = await this.verify(token, this.refreshSecret, "refresh");
    return { userId: payload.sub, sessionId: payload.sid, role: payload.role };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  refreshExpiresAt(): Date {
    return new Date(Date.now() + this.env.JWT_REFRESH_TTL_SECONDS * 1000);
  }

  private async sign(
    payload: TokenPayload,
    secret: Uint8Array,
    expiresInSeconds: number,
  ): Promise<string> {
    return new SignJWT({
      sid: payload.sid,
      role: payload.role,
      tokenType: payload.tokenType,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(payload.sub)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${expiresInSeconds}s`)
      .sign(secret);
  }

  private async verify(
    token: string,
    secret: Uint8Array,
    expectedType: TokenPayload["tokenType"],
  ): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      const role = payload.role;

      if (
        !payload.sub ||
        typeof payload.sid !== "string" ||
        payload.tokenType !== expectedType ||
        (role !== "OWNER" && role !== "SERVICE_STAFF" && role !== "BARISTA")
      ) {
        throw new Error("Invalid token claims");
      }

      return {
        sub: payload.sub,
        sid: payload.sid,
        role,
        tokenType: expectedType,
      };
    } catch (error) {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", {
        cause: error,
      });
    }
  }
}
