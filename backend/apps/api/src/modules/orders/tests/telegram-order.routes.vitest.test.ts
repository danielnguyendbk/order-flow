import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TelegramEmployeeRepository } from "../../auth/telegram-session.types";
import { createTelegramOrderRouter } from "../telegram-order.routes";
import { TelegramOrderError, type TelegramOrderDto, type TelegramOrderServiceContract } from "../telegram-order.service";

const internalSecret = "order-test-secret";
const draft: TelegramOrderDto = {
  id: "order-1",
  code: "ORD-001",
  paymentMethod: null,
  paymentStatus: "UNPAID",
  fulfillmentStatus: "PENDING_PAYMENT",
  totalAmount: 30_000,
  items: [{ id: "line-1", menuItemId: "item-1", name: "Trà đào", quantity: 1, unitPrice: 30_000 }],
};

let server: Server | undefined;

function fakeService(overrides: Partial<TelegramOrderServiceContract> = {}): TelegramOrderServiceContract {
  return {
    listCategories: vi.fn().mockResolvedValue([{ id: "tea", name: "Trà" }]),
    listItems: vi.fn().mockResolvedValue([{ id: "item-1", categoryId: "tea", name: "Trà đào", price: 30_000, isActive: true }]),
    createDraft: vi.fn().mockResolvedValue({ ...draft, items: [], totalAmount: 0 }),
    listMine: vi.fn().mockResolvedValue([draft]),
    getOrder: vi.fn().mockResolvedValue(draft),
    addItem: vi.fn().mockResolvedValue(draft),
    updateItem: vi.fn().mockResolvedValue(draft),
    deleteItem: vi.fn().mockResolvedValue({ ...draft, items: [], totalAmount: 0 }),
    cancelDraft: vi.fn().mockResolvedValue({ ...draft, fulfillmentStatus: "CANCELLED" }),
    confirmCash: vi.fn().mockResolvedValue({ ...draft, paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED" }),
    createQr: vi.fn().mockResolvedValue({
      order: { ...draft, paymentMethod: "QR", paymentStatus: "PENDING" },
      paymentCode: "PAYORD001",
      amount: 30_000,
      qrImageUrl: "https://vietqr.app/img?amount=30000",
    }),
    deliver: vi.fn().mockResolvedValue({ ...draft, fulfillmentStatus: "DELIVERED" }),
    ...overrides,
  };
}

async function startApi(
  service: TelegramOrderServiceContract,
  employeeStatus: "ACTIVE" | "INACTIVE" = "ACTIVE",
  employeeRole: "SERVICE_STAFF" | "BARISTA" = "SERVICE_STAFF",
): Promise<string> {
  const employees: TelegramEmployeeRepository = {
    findByTelegramUserId: async () => ({
      id: "employee-1",
      fullName: "Khoa",
      telegramUserId: 123n,
      role: employeeRole,
      status: employeeStatus,
    }),
  };
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createTelegramOrderRouter({ internalSecret, employeeRepository: employees, orderService: service }));
  app.post("/api/v1/orders", (_req, res) => res.status(418).json({ source: "legacy-order-route" }));
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}/api/v1`;
}

async function apiRequest(baseUrl: string, path: string, method = "GET", body?: unknown, secret = internalSecret): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-bot-internal-secret": secret,
      "x-telegram-user-id": "123",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("Telegram service-staff order HTTP contract", () => {
  it("serves menu, draft CRUD, mine and status endpoints with backend employee ownership", async () => {
    const service = fakeService();
    const baseUrl = await startApi(service);

    expect((await apiRequest(baseUrl, "/menu/categories")).status).toBe(200);
    expect((await apiRequest(baseUrl, "/menu/items?categoryId=tea")).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders", "POST")).status).toBe(201);
    expect((await apiRequest(baseUrl, "/orders?mine=true")).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders/order-1")).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders/order-1/items", "POST", { menuItemId: "item-1", quantity: 2 })).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders/order-1/items/line-1", "PATCH", { note: "Ít đá" })).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders/order-1/items/line-1", "DELETE")).status).toBe(200);
    expect((await apiRequest(baseUrl, "/orders/order-1/cancel", "POST")).status).toBe(200);

    expect(service.createDraft).toHaveBeenCalledWith("employee-1");
    expect(service.addItem).toHaveBeenCalledWith("employee-1", "order-1", { menuItemId: "item-1", quantity: 2 });
    expect(service.listMine).toHaveBeenCalledWith("employee-1");
  });

  it("supports CASH and QR payment endpoints", async () => {
    const service = fakeService();
    const baseUrl = await startApi(service);
    const cash = await apiRequest(baseUrl, "/orders/order-1/payments/cash/confirm", "POST");
    const qr = await apiRequest(baseUrl, "/orders/order-1/payments/qr", "POST");
    expect(cash.status).toBe(200);
    expect(await cash.json()).toMatchObject({ paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED" });
    expect(qr.status).toBe(200);
    expect(await qr.json()).toMatchObject({ paymentCode: "PAYORD001", amount: 30_000 });
    const delivered = await apiRequest(baseUrl, "/orders/order-1/deliver", "POST", { requesterId: "attacker" });
    expect(delivered.status).toBe(200);
    expect(service.deliver).toHaveBeenCalledWith("employee-1", "order-1");
  });

  it("rejects invalid credentials and an employee who becomes inactive", async () => {
    const service = fakeService();
    let baseUrl = await startApi(service);
    expect((await apiRequest(baseUrl, "/orders", "POST", undefined, "wrong-secret")).status).toBe(401);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;

    baseUrl = await startApi(service, "INACTIVE");
    expect((await apiRequest(baseUrl, "/orders", "POST")).status).toBe(403);
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it("rejects a non-service-staff Telegram role", async () => {
    const service = fakeService();
    const baseUrl = await startApi(service, "ACTIVE", "BARISTA");
    const response = await apiRequest(baseUrl, "/orders", "POST");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ROLE_FORBIDDEN" });
  });

  it("passes a request without Bot headers to the existing order API", async () => {
    const baseUrl = await startApi(fakeService());
    const response = await fetch(`${baseUrl}/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ source: "legacy-order-route" });
  });

  it("preserves domain error status and code", async () => {
    const baseUrl = await startApi(fakeService({
      getOrder: vi.fn().mockRejectedValue(new TelegramOrderError(403, "ORDER_FORBIDDEN", "Order belongs to another employee")),
    }));
    const response = await apiRequest(baseUrl, "/orders/other-order");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "ORDER_FORBIDDEN", message: "Order belongs to another employee" });
  });
});
