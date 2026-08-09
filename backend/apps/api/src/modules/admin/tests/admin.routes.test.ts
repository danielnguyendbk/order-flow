import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../core/errors.js";
import type { AuthServicePort } from "../../auth/auth.service.js";
import { createAdminRouter } from "../admin.routes";
import { FulfillmentStatus, OrderStatusDomain, PaymentStatus } from "../../orders/order.types";

const ownerToken = "owner-token";
const staffToken = "staff-token";
const baristaToken = "barista-token";

const order = {
  id: "order-1",
  orderCode: "ORD-001",
  createdByUserId: "customer-1",
  assignedBaristaId: "barista-1",
  paymentMethod: "QR",
  paymentStatus: PaymentStatus.PAID,
  fulfillmentStatus: FulfillmentStatus.QUEUED,
  totalAmount: 45000n,
  customerNote: "No sugar",
  cancellationReason: null,
  paidAt: new Date("2026-08-06T00:00:00.000Z"),
  items: [
    {
      id: "item-1",
      orderId: "order-1",
      menuItemId: "menu-1",
      itemName: "Caffe latte",
      unitPrice: 45000n,
      quantity: 1,
      note: null,
    },
  ],
  timeline: [
    {
      id: "history-1",
      orderId: "order-1",
      statusDomain: OrderStatusDomain.FULFILLMENT,
      oldStatus: FulfillmentStatus.PENDING_PAYMENT,
      newStatus: FulfillmentStatus.QUEUED,
      changedByUserId: "staff-1",
      reason: "Marked paid",
      createdAt: new Date("2026-08-06T00:00:00.000Z"),
    },
  ],
};

let server: Server | undefined;

function fakeAuthService(): AuthServicePort {
  return {
    loginAdmin: vi.fn(),
    createTelegramSession: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    authenticate: vi.fn(async (token: string, roles?: Array<"OWNER" | "SERVICE_STAFF" | "BARISTA">) => {
      const identityByToken: Record<string, { userId: string; sessionId: string; role: "OWNER" | "SERVICE_STAFF" | "BARISTA" }> = {
        [ownerToken]: { userId: "owner-1", sessionId: "session-owner", role: "OWNER" },
        [staffToken]: { userId: "staff-1", sessionId: "session-staff", role: "SERVICE_STAFF" },
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
    }),
  };
}

function fakeAdminRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findAll: vi.fn().mockResolvedValue({ data: [order], total: 1, page: 1, limit: 20 }),
    findById: vi.fn().mockResolvedValue(order),
    ...overrides,
  };
}

function fakeOrderService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    overrideStatus: vi.fn().mockResolvedValue({
      ...order,
      fulfillmentStatus: FulfillmentStatus.READY,
      timeline: [
        ...order.timeline,
        {
          id: "history-2",
          orderId: "order-1",
          statusDomain: OrderStatusDomain.FULFILLMENT,
          oldStatus: FulfillmentStatus.QUEUED,
          newStatus: FulfillmentStatus.READY,
          changedByUserId: "staff-1",
          reason: "Customer requested faster pickup",
          createdAt: new Date("2026-08-06T01:00:00.000Z"),
        },
      ],
    }),
    ...overrides,
  };
}

async function startApi() {
  const app = express();
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  app.use(express.json());
  app.use(
    "/api/v1/admin",
    createAdminRouter(fakeAuthService(), {
      adminRepository: fakeAdminRepository() as any,
      orderService: fakeOrderService() as any,
    }),
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}/api/v1/admin`;
}

function request(baseUrl: string, path: string, method = "GET", token = ownerToken, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

describe("Admin order routes", () => {
  it("allows owner and service staff to list and inspect orders", async () => {
    const baseUrl = await startApi();
    const list = await request(baseUrl, "/orders");
    const detail = await request(baseUrl, "/orders/order-1");

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: "order-1",
          timeline: expect.arrayContaining([
            expect.objectContaining({ newStatus: FulfillmentStatus.QUEUED, changedByUserId: "staff-1" }),
          ]),
        }),
      ],
    });
    expect((await detail.json()).timeline).toHaveLength(1);

    const staffList = await request(baseUrl, "/orders", "GET", staffToken);
    expect(staffList.status).toBe(200);
  });

  it("overrides status using the authenticated actor and requires a reason", async () => {
    const baseUrl = await startApi();
    const response = await request(baseUrl, "/orders/order-1/override-status", "POST", staffToken, {
      domain: "FULFILLMENT",
      status: "READY",
      reason: "Customer asked to expedite",
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ fulfillmentStatus: FulfillmentStatus.READY });

    const bad = await request(baseUrl, "/orders/order-1/override-status", "POST", staffToken, {
      domain: "PAYMENT",
      status: "PAID",
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ errors: expect.arrayContaining(["reason is required"]) });
  });

  it("rejects non-admin roles", async () => {
    const baseUrl = await startApi();
    const response = await request(baseUrl, "/orders", "GET", baristaToken);
    expect(response.status).toBe(403);
  });
});
