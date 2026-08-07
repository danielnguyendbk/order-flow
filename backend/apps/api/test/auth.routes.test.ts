import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { AppError } from "../src/core/errors.js";
import type {
  AuthServicePort,
  RequestMetadata,
} from "../src/modules/auth/auth.service.js";
import type {
  AccessIdentity,
  AuthSessionResult,
  PublicAuthUser,
} from "../src/modules/auth/auth.types.js";

const user: PublicAuthUser = {
  id: "29fb80af-25dc-4a21-aab8-f17fb93578ab",
  fullName: "Store Owner",
  username: "owner",
  telegramUserId: null,
  role: "OWNER",
};

const session: AuthSessionResult = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tokenType: "Bearer",
  expiresIn: 900,
  user,
};

class FakeAuthService implements AuthServicePort {
  logoutCalls = 0;

  async loginAdmin(
    username: string,
    password: string,
    _metadata?: RequestMetadata,
  ): Promise<AuthSessionResult> {
    if (username !== "owner" || password !== "correct-password") {
      throw new AppError("INVALID_CREDENTIALS", "Invalid username or password");
    }
    return session;
  }

  async createTelegramSession(): Promise<AuthSessionResult> {
    return session;
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    if (refreshToken !== "refresh-token") {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token");
    }
    return session;
  }

  async authenticate(
    accessToken: string,
    requiredRole?: "OWNER",
  ): Promise<AccessIdentity> {
    if (accessToken !== "access-token" || requiredRole !== "OWNER") {
      throw new AppError("UNAUTHORIZED", "Invalid access token");
    }
    return { userId: user.id, sessionId: "session-id", role: "OWNER" };
  }

  async me(): Promise<PublicAuthUser> {
    return user;
  }

  async logout(): Promise<void> {
    this.logoutCalls += 1;
  }
}

test("admin auth routes support login, refresh, me, and logout", async () => {
  const authService = new FakeAuthService();
  const app = createApp({ authService });

  const login = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "owner", password: "correct-password" });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body, { data: session });

  const refresh = await request(app)
    .post("/api/v1/admin/auth/refresh")
    .send({ refreshToken: "refresh-token" });
  assert.equal(refresh.status, 200);

  const me = await request(app)
    .get("/api/v1/admin/auth/me")
    .set("authorization", "Bearer access-token");
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, { data: user });

  const logout = await request(app)
    .post("/api/v1/admin/auth/logout")
    .set("authorization", "Bearer access-token");
  assert.equal(logout.status, 204);
  assert.equal(authService.logoutCalls, 1);
});

test("admin auth routes reject invalid input and missing bearer token", async () => {
  const app = createApp({ authService: new FakeAuthService() });

  const invalidLogin = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "", password: "short" });
  assert.equal(invalidLogin.status, 400);
  assert.equal(invalidLogin.body.error.code, "VALIDATION_ERROR");

  const missingToken = await request(app).get("/api/v1/admin/auth/me");
  assert.equal(missingToken.status, 401);
  assert.equal(missingToken.body.error.code, "UNAUTHORIZED");

  const invalidCredentials = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "owner", password: "incorrect-password" });
  assert.equal(invalidCredentials.status, 401);
  assert.equal(invalidCredentials.body.error.code, "INVALID_CREDENTIALS");
});
