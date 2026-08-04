import assert from "node:assert/strict";
import test from "node:test";

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

test("admin auth routes support login, refresh, me, and logout", async (context) => {
  const authService = new FakeAuthService();
  const app = await createApp({ authService });
  context.after(() => app.close());

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    payload: { username: "owner", password: "correct-password" },
  });
  assert.equal(login.statusCode, 200);
  assert.deepEqual(login.json(), { data: session });

  const refresh = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/refresh",
    payload: { refreshToken: "refresh-token" },
  });
  assert.equal(refresh.statusCode, 200);

  const me = await app.inject({
    method: "GET",
    url: "/api/v1/admin/auth/me",
    headers: { authorization: "Bearer access-token" },
  });
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json(), { data: user });

  const logout = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/logout",
    headers: { authorization: "Bearer access-token" },
  });
  assert.equal(logout.statusCode, 204);
  assert.equal(authService.logoutCalls, 1);
});

test("admin auth routes reject invalid input and missing bearer token", async (context) => {
  const app = await createApp({ authService: new FakeAuthService() });
  context.after(() => app.close());

  const invalidLogin = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    payload: { username: "", password: "short" },
  });
  assert.equal(invalidLogin.statusCode, 400);
  assert.equal(invalidLogin.json().error.code, "VALIDATION_ERROR");

  const missingToken = await app.inject({
    method: "GET",
    url: "/api/v1/admin/auth/me",
  });
  assert.equal(missingToken.statusCode, 401);
  assert.equal(missingToken.json().error.code, "UNAUTHORIZED");

  const invalidCredentials = await app.inject({
    method: "POST",
    url: "/api/v1/admin/auth/login",
    payload: { username: "owner", password: "incorrect-password" },
  });
  assert.equal(invalidCredentials.statusCode, 401);
  assert.equal(invalidCredentials.json().error.code, "INVALID_CREDENTIALS");
});

