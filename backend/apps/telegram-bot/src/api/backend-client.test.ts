import { createServer } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendClient } from "./backend-client.js";

afterEach(() => vi.unstubAllGlobals());

describe("BackendClient", () => {
  it("calls the configured API base URL with the internal bot secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          employeeId: "employee-1",
          telegramUserId: 123,
          displayName: "Khoa",
          role: "SERVICE_STAFF",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BackendClient("http://localhost:3000/api/v1", "internal-secret");
    await client.createTelegramSession(123);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/v1/telegram/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bot-internal-secret": "internal-secret",
      },
      body: JSON.stringify({ telegramUserId: 123 }),
    });
  });

  it("reaches a backend HTTP server through the configured base URL", async () => {
    const received: Array<{ url?: string; method?: string; secret?: string }> = [];
    const server = createServer((request, response) => {
      received.push({
        url: request.url,
        method: request.method,
        secret: request.headers["x-bot-internal-secret"] as string | undefined,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          employeeId: "employee-1",
          telegramUserId: 456,
          displayName: "Khoa",
          role: "SERVICE_STAFF",
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose a TCP port");

    try {
      const client = new BackendClient(`http://127.0.0.1:${address.port}/api/v1`, "integration-secret");
      await client.createTelegramSession(456);

      expect(received).toEqual([
        {
          url: "/api/v1/telegram/session",
          method: "POST",
          secret: "integration-secret",
        },
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects a malformed Telegram session response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ employeeId: "employee-1", telegramUserId: 123, role: "OWNER" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));

    const client = new BackendClient("http://localhost:3000/api/v1", "internal-secret");
    await expect(client.createTelegramSession(123)).rejects.toMatchObject({
      status: 502,
      code: "SESSION_RESPONSE_INVALID",
    });
  });

  it("calls mine, CASH and QR endpoints with the Telegram identity", async () => {
    const order = {
      id: "order-1",
      code: "ORD-001",
      paymentStatus: "PAID",
      fulfillmentStatus: "QUEUED",
      totalAmount: 30_000,
      items: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([order]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(order), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ order, paymentCode: "PAYORD001", amount: 30_000, qrImageUrl: "https://vietqr.app/img" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://localhost:3000/api/v1", "internal-secret");

    await client.listMyOrders(123);
    await client.confirmCashPayment(123, "order-1");
    await client.createQrPayment(123, "order-1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3000/api/v1/orders?mine=true",
      "http://localhost:3000/api/v1/orders/order-1/payments/cash/confirm",
      "http://localhost:3000/api/v1/orders/order-1/payments/qr",
    ]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "x-telegram-user-id": "123" }),
    });
  });

  it("calls all Barista endpoints with the Telegram identity", async () => {
    const response = new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response.clone()));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://localhost:3000/api/v1", "internal-secret");

    await client.listBaristaQueue(202);
    await client.listBaristaOrders(202);
    await client.getBaristaOrder(202, "order-1");
    await client.getBaristaOrderHistory(202, "order-1");
    await client.claimBaristaOrder(202, "order-1");
    await client.markBaristaOrderReady(202, "order-1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3000/api/v1/barista/queue",
      "http://localhost:3000/api/v1/barista/orders",
      "http://localhost:3000/api/v1/barista/orders/order-1",
      "http://localhost:3000/api/v1/barista/orders/order-1/history",
      "http://localhost:3000/api/v1/orders/order-1/claim",
      "http://localhost:3000/api/v1/orders/order-1/ready",
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => init.headers["x-telegram-user-id"] === "202")).toBe(true);
  });
});
