import assert from "node:assert/strict";
import test from "node:test";
import { hashSync } from "bcryptjs";

import type { AppEnv } from "../src/config/env.js";
import { AppError } from "../src/core/errors.js";
import type { AuthRepositoryPort } from "../src/modules/auth/auth.repository.js";
import { MemoryAuthSessionStore } from "../src/modules/auth/auth-session.store.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { AuthTokenService } from "../src/modules/auth/auth.tokens.js";
import type {
  AuthUser,
  AuthUserWithPassword,
} from "../src/modules/auth/auth.types.js";

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  JWT_ACCESS_SECRET: "access-secret-that-is-at-least-32-characters",
  JWT_REFRESH_SECRET: "refresh-secret-that-is-at-least-32-characters",
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
  AUTH_SESSION_CACHE_MAX: 100,
  TELEGRAM_BOT_TOKEN: "123456:test-bot-token",
  TELEGRAM_AUTH_MAX_AGE_SECONDS: 300,
};

const owner: AuthUserWithPassword = {
  id: "29fb80af-25dc-4a21-aab8-f17fb93578ab",
  fullName: "Store Owner",
  username: "owner",
  telegramUserId: null,
  passwordHash: hashSync("correct-password", 4),
  role: "OWNER",
  status: "ACTIVE",
};

class MemoryAuthRepository implements AuthRepositoryPort {
  async findAdminByUsername(username: string): Promise<AuthUserWithPassword | null> {
    return username.toLowerCase() === owner.username ? owner : null;
  }

  async findTelegramUser(): Promise<AuthUser | null> {
    return null;
  }

  async findUserById(userId: string): Promise<AuthUser | null> {
    return userId === owner.id ? owner : null;
  }
}

function createService(): AuthService {
  return new AuthService(
    new MemoryAuthRepository(),
    new MemoryAuthSessionStore(env.AUTH_SESSION_CACHE_MAX),
    new AuthTokenService(env),
    env,
  );
}

test("admin login issues usable tokens and logout revokes the session", async () => {
  const service = createService();

  const session = await service.loginAdmin("OWNER", "correct-password");
  assert.equal(session.user.role, "OWNER");
  assert.equal(session.tokenType, "Bearer");

  const identity = await service.authenticate(session.accessToken, "OWNER");
  assert.equal(identity.userId, owner.id);

  await service.logout(identity);
  await assert.rejects(
    service.authenticate(session.accessToken, "OWNER"),
    (error) => error instanceof AppError && error.code === "UNAUTHORIZED",
  );
});

test("refresh rotates tokens and detects reuse", async () => {
  const service = createService();
  const original = await service.loginAdmin("owner", "correct-password");
  const rotated = await service.refresh(original.refreshToken);

  assert.notEqual(rotated.refreshToken, original.refreshToken);
  await assert.rejects(
    service.refresh(original.refreshToken),
    (error) => error instanceof AppError && error.code === "UNAUTHORIZED",
  );
  await assert.rejects(
    service.refresh(rotated.refreshToken),
    (error) => error instanceof AppError && error.code === "UNAUTHORIZED",
  );
});

test("admin login does not reveal whether username or password is wrong", async () => {
  const service = createService();

  for (const [username, password] of [
    ["missing", "correct-password"],
    ["owner", "incorrect-password"],
  ]) {
    await assert.rejects(
      service.loginAdmin(username!, password!),
      (error) =>
        error instanceof AppError &&
        error.code === "INVALID_CREDENTIALS" &&
        error.message === "Invalid username or password",
    );
  }
});

test("Telegram auth can be disabled without affecting API startup", async () => {
  const telegramDisabledEnv = { ...env, TELEGRAM_BOT_TOKEN: "" };
  const service = new AuthService(
    new MemoryAuthRepository(),
    new MemoryAuthSessionStore(telegramDisabledEnv.AUTH_SESSION_CACHE_MAX),
    new AuthTokenService(telegramDisabledEnv),
    telegramDisabledEnv,
  );

  await assert.rejects(
    service.createTelegramSession("unused-while-disabled"),
    (error) => error instanceof AppError && error.code === "SERVICE_UNAVAILABLE",
  );
});
