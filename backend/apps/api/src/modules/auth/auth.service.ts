import { compare } from "bcryptjs";

import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import type { AuthRepositoryPort } from "./auth.repository.js";
import type { AuthSessionStorePort } from "./auth-session.store.js";
import { AuthTokenService } from "./auth.tokens.js";
import type {
  AccessIdentity,
  AuthSessionResult,
  AuthUser,
  PublicAuthUser,
} from "./auth.types.js";
import { toPublicAuthUser } from "./auth.types.js";
import { verifyTelegramInitData } from "./telegram-init-data.js";

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthServicePort {
  loginAdmin(
    username: string,
    password: string,
    metadata?: RequestMetadata,
  ): Promise<AuthSessionResult>;
  createTelegramSession(
    initData: string,
    metadata?: RequestMetadata,
  ): Promise<AuthSessionResult>;
  refresh(refreshToken: string): Promise<AuthSessionResult>;
  authenticate(accessToken: string, requiredRole?: "OWNER"): Promise<AccessIdentity>;
  me(identity: AccessIdentity): Promise<PublicAuthUser>;
  logout(identity: AccessIdentity): Promise<void>;
}

export class AuthService implements AuthServicePort {
  constructor(
    private readonly repository: AuthRepositoryPort,
    private readonly sessions: AuthSessionStorePort,
    private readonly tokens: AuthTokenService,
    private readonly env: AppEnv,
  ) {}

  async loginAdmin(
    username: string,
    password: string,
    metadata: RequestMetadata = {},
  ): Promise<AuthSessionResult> {
    const user = await this.repository.findAdminByUsername(username);
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid username or password");
    }
    this.ensureActive(user);
    return this.createSession(user, metadata);
  }

  async createTelegramSession(
    initData: string,
    metadata: RequestMetadata = {},
  ): Promise<AuthSessionResult> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Telegram authentication is temporarily disabled",
      );
    }
    const telegram = verifyTelegramInitData(
      initData,
      this.env.TELEGRAM_BOT_TOKEN,
      this.env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
    );
    const user = await this.repository.findTelegramUser(telegram.id);
    if (!user) {
      throw new AppError("FORBIDDEN", "Telegram account is not registered");
    }
    this.ensureActive(user);
    return this.createSession(user, metadata);
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    const identity = await this.tokens.verifyRefreshToken(refreshToken);
    const user = await this.repository.findUserById(identity.userId);
    if (!user || user.status !== "ACTIVE") {
      this.sessions.revoke(identity.sessionId, identity.userId);
      throw new AppError("UNAUTHORIZED", "Refresh session is invalid or expired");
    }

    const nextRefreshToken = await this.tokens.signRefreshToken(
      user,
      identity.sessionId,
    );
    const rotated = this.sessions.rotate({
      sessionId: identity.sessionId,
      userId: identity.userId,
      currentTokenHash: this.tokens.hashRefreshToken(refreshToken),
      nextTokenHash: this.tokens.hashRefreshToken(nextRefreshToken),
      expiresAt: this.tokens.refreshExpiresAt(),
    });

    if (!rotated) {
      throw new AppError("UNAUTHORIZED", "Refresh session is invalid or expired");
    }

    const accessToken = await this.tokens.signAccessToken(user, identity.sessionId);
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      tokenType: "Bearer",
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      user: toPublicAuthUser(user),
    };
  }

  async authenticate(
    accessToken: string,
    requiredRole?: "OWNER",
  ): Promise<AccessIdentity> {
    const identity = await this.tokens.verifyAccessToken(accessToken);
    if (!this.sessions.isActive(identity.sessionId, identity.userId)) {
      throw new AppError("UNAUTHORIZED", "Session is invalid or expired");
    }
    const user = await this.repository.findUserById(identity.userId);
    if (!user || user.status !== "ACTIVE") {
      this.sessions.revoke(identity.sessionId, identity.userId);
      throw new AppError("UNAUTHORIZED", "Session is invalid or expired");
    }
    if (requiredRole && user.role !== requiredRole) {
      throw new AppError("FORBIDDEN", "Insufficient permissions");
    }
    return { ...identity, role: user.role };
  }

  async me(identity: AccessIdentity): Promise<PublicAuthUser> {
    const user = await this.repository.findUserById(identity.userId);
    if (!user) {
      throw new AppError("NOT_FOUND", "User not found");
    }
    this.ensureActive(user);
    return toPublicAuthUser(user);
  }

  async logout(identity: AccessIdentity): Promise<void> {
    this.sessions.revoke(identity.sessionId, identity.userId);
  }

  private async createSession(
    user: AuthUser,
    metadata: RequestMetadata,
  ): Promise<AuthSessionResult> {
    const sessionId = this.tokens.createSessionId();
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(user, sessionId),
      this.tokens.signRefreshToken(user, sessionId),
    ]);
    this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt: this.tokens.refreshExpiresAt(),
      ...metadata,
    });
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      user: toPublicAuthUser(user),
    };
  }

  private ensureActive(user: AuthUser): void {
    if (user.status !== "ACTIVE") {
      throw new AppError("ACCOUNT_INACTIVE", "Account is inactive");
    }
  }
}
