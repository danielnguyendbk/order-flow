import { createServer, type Server } from "node:http";

import express, { Router, type Router as RouterType } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../core/errors.js";
import type { AuthServicePort } from "../modules/auth/auth.service.js";
import { createApiRouter, type OperationalRouterFactories } from "./index.js";

const ownerToken = "owner-token";
const baristaToken = "barista-token";

function fakeAuthService(): AuthServicePort {
  return {
    loginAdmin: vi.fn(),
    createTelegramSession: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    authenticate: vi.fn(
      async (token: string, roles?: Array<"OWNER" | "SERVICE_STAFF" | "BARISTA">) => {
        const identityByToken: Record<
          string,
          { userId: string; sessionId: string; role: "OWNER" | "SERVICE_STAFF" | "BARISTA" }
        > = {
          [ownerToken]: { userId: "owner-1", sessionId: "session-owner", role: "OWNER" },
          [baristaToken]: { userId: "barista-1", sessionId: "session-barista", role: "BARISTA" },
        };
        const identity = identityByToken[token];
        if (!identity) {
          throw new AppError("UNAUTHORIZED", "Invalid token");
        }
        if (roles && !roles.includes(identity.role)) {
          throw new AppError("FORBIDDEN", "Insufficient permissions");
        }
        return identity;
      },
    ),
  };
}

/** Stub routers replace the Prisma-backed operational modules in tests. */
function stubRouter(): RouterType {
  const router = Router();
  router.use((_req, res) => res.status(204).end());
  return router;
}

const stubOperationalRouters: OperationalRouterFactories = {
  createOrderRouter: () => stubRouter(),
  createBaristaRouter: () => stubRouter(),
  createAdminRouter: () => stubRouter(),
};

let server: Server | undefined;

async function startApi() {
  const app = express();
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  app.use(express.json());
  app.use(
    "/api/v1",
    createApiRouter(fakeAuthService(), true, undefined, undefined, undefined, stubOperationalRouters),
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}/api/v1`;
}

function request(baseUrl: string, path: string, token?: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({}),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server!.close((error) => (error ? reject(error) : resolve())),
  );
  server = undefined;
});

describe("Operational /orders router auth gate", () => {
  it("rejects anonymous callers with 401 before reaching the handler", async () => {
    const baseUrl = await startApi();
    const response = await request(baseUrl, "/orders/order-1/payments/qr");
    expect(response.status).toBe(401);
  });

  it("rejects roles outside OWNER/SERVICE_STAFF with 403", async () => {
    const baseUrl = await startApi();
    const response = await request(baseUrl, "/orders/order-1/payments/qr", baristaToken);
    expect(response.status).toBe(403);
  });

  it("protects the barista router with the same auth gate", async () => {
    const baseUrl = await startApi();
    expect((await request(baseUrl, "/barista/queue")).status).toBe(401);
    expect((await request(baseUrl, "/barista/queue", baristaToken)).status).toBe(403);
    expect((await request(baseUrl, "/barista/queue", ownerToken)).status).toBe(204);
  });

  it("lets an OWNER token through the gate into the router", async () => {
    const baseUrl = await startApi();
    const response = await request(baseUrl, "/orders/order-1/payments/qr", ownerToken);
    expect(response.status).toBe(204);
  });
});
