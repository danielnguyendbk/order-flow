import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TelegramEmployeeRepository } from "../../auth/telegram-session.types";
import { TelegramOrderError } from "../../orders/telegram-order.service";
import { createTelegramBaristaRouter } from "../telegram-barista.routes";
import type { TelegramBaristaOrderDto, TelegramBaristaServiceContract } from "../telegram-barista.service";

const internalSecret = "barista-test-secret";
const order: TelegramBaristaOrderDto = {
  id: "order-1",
  code: "ORD-001",
  paymentStatus: "PAID",
  fulfillmentStatus: "QUEUED",
  totalAmount: 30_000,
  assignedBaristaId: null,
  createdAt: "2026-08-05T00:00:00.000Z",
  items: [{ id: "line-1", name: "Trà đào", quantity: 1 }],
};

let server: Server | undefined;

function fakeService(overrides: Partial<TelegramBaristaServiceContract> = {}): TelegramBaristaServiceContract {
  return {
    listQueue: vi.fn().mockResolvedValue([order]),
    listMine: vi.fn().mockResolvedValue([{ ...order, fulfillmentStatus: "PREPARING", assignedBaristaId: "barista-1" }]),
    getOrder: vi.fn().mockResolvedValue(order),
    getHistory: vi.fn().mockResolvedValue([]),
    claim: vi.fn().mockResolvedValue({ ...order, fulfillmentStatus: "PREPARING", assignedBaristaId: "barista-1" }),
    markReady: vi.fn().mockResolvedValue({ ...order, fulfillmentStatus: "READY", assignedBaristaId: "barista-1" }),
    ...overrides,
  };
}

async function startApi(
  service: TelegramBaristaServiceContract,
  role: "BARISTA" | "SERVICE_STAFF" = "BARISTA",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): Promise<string> {
  const employees: TelegramEmployeeRepository = {
    findByTelegramUserId: async () => ({
      id: "barista-1",
      fullName: "Khoa",
      telegramUserId: 202n,
      role,
      status,
    }),
  };
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createTelegramBaristaRouter({ internalSecret, employeeRepository: employees, baristaService: service }));
  app.post("/api/v1/orders/:orderId/claim", (_req, res) => res.status(418).json({ source: "legacy" }));
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}/api/v1`;
}

function request(baseUrl: string, path: string, method = "GET", secret = internalSecret): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-bot-internal-secret": secret, "x-telegram-user-id": "202" },
    body: method === "GET" ? undefined : JSON.stringify({ baristaId: "attacker-selected-id" }),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("Telegram barista HTTP contract", () => {
  it("serves queue, mine, detail and history to an active barista", async () => {
    const service = fakeService();
    const baseUrl = await startApi(service);
    expect((await request(baseUrl, "/barista/queue")).status).toBe(200);
    expect((await request(baseUrl, "/barista/orders")).status).toBe(200);
    expect((await request(baseUrl, "/barista/orders/order-1")).status).toBe(200);
    expect((await request(baseUrl, "/barista/orders/order-1/history")).status).toBe(200);
    expect(service.listMine).toHaveBeenCalledWith("barista-1");
    expect(service.getOrder).toHaveBeenCalledWith("barista-1", "order-1");
    expect(service.getHistory).toHaveBeenCalledWith("barista-1", "order-1");
  });

  it("derives the actor from Telegram authentication for claim and ready", async () => {
    const service = fakeService();
    const baseUrl = await startApi(service);
    expect((await request(baseUrl, "/orders/order-1/claim", "POST")).status).toBe(200);
    expect((await request(baseUrl, "/orders/order-1/ready", "POST")).status).toBe(200);
    expect(service.claim).toHaveBeenCalledWith("barista-1", "order-1");
    expect(service.markReady).toHaveBeenCalledWith("barista-1", "order-1");
  });

  it("rejects an invalid secret, inactive employee and wrong role", async () => {
    let baseUrl = await startApi(fakeService());
    expect((await request(baseUrl, "/barista/queue", "GET", "wrong")).status).toBe(401);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    baseUrl = await startApi(fakeService(), "BARISTA", "INACTIVE");
    expect((await request(baseUrl, "/barista/queue")).status).toBe(403);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    baseUrl = await startApi(fakeService(), "SERVICE_STAFF");
    const response = await request(baseUrl, "/barista/queue");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ROLE_FORBIDDEN" });
  });

  it("preserves domain conflicts for stale actions", async () => {
    const baseUrl = await startApi(fakeService({
      claim: vi.fn().mockRejectedValue(new TelegramOrderError(409, "ORDER_ALREADY_CLAIMED", "Already claimed")),
    }));
    const response = await request(baseUrl, "/orders/order-1/claim", "POST");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ORDER_ALREADY_CLAIMED", message: "Already claimed" });
  });

  it("does not allow callers to bypass Telegram authentication by omitting Bot headers", async () => {
    const baseUrl = await startApi(fakeService());
    const response = await fetch(`${baseUrl}/orders/order-1/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(401);
  });
});
