import { createServer, type Server } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSepayTunnelProxy } from "../sepay-tunnel-proxy";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("SePay tunnel proxy", () => {
  it("exposes only the exact SePay POST path", async () => {
    const proxy = createSepayTunnelProxy("http://127.0.0.1:65534");
    servers.push(proxy);

    expect((await request(proxy).get("/health")).status).toBe(404);
    expect((await request(proxy).post("/api/v1/orders")).status).toBe(404);
    expect((await request(proxy).get("/api/v1/webhooks/sepay")).status).toBe(404);
  });

  it("forwards the webhook body and authentication header", async () => {
    const received = vi.fn();
    const upstream = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        received({ method: req.method, url: req.url, authorization: req.headers.authorization, body });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
    });
    servers.push(upstream);
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (!address || typeof address === "string") throw new Error("Upstream did not expose a port");

    const proxy = createSepayTunnelProxy(`http://127.0.0.1:${address.port}`);
    servers.push(proxy);
    const response = await request(proxy)
      .post("/api/v1/webhooks/sepay")
      .set("Authorization", "Apikey test-key")
      .send({ id: 1, transferAmount: 1000 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(received).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "/api/v1/webhooks/sepay",
      authorization: "Apikey test-key",
    }));
  });
});
