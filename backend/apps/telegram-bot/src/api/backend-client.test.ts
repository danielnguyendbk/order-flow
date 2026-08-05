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
});
