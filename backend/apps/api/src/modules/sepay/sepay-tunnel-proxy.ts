import { createServer, request as createRequest, type Server } from "node:http";

const WEBHOOK_PATH = "/api/v1/webhooks/sepay";
const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "content-length",
  "x-sepay-webhook-secret",
  "x-webhook-secret",
] as const;

export function createSepayTunnelProxy(upstreamOrigin = "http://127.0.0.1:3001"): Server {
  const upstream = new URL(upstreamOrigin);
  return createServer((incoming, outgoing) => {
    const pathname = new URL(incoming.url ?? "/", "http://localhost").pathname;
    if (incoming.method !== "POST" || pathname !== WEBHOOK_PATH) {
      outgoing.writeHead(404, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const headers: Record<string, string | string[]> = {};
    for (const name of FORWARDED_HEADERS) {
      const value = incoming.headers[name];
      if (value !== undefined) headers[name] = value;
    }

    const request = createRequest({
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      method: "POST",
      path: WEBHOOK_PATH,
      headers,
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, {
        ...(response.headers["content-type"] ? { "content-type": response.headers["content-type"] } : {}),
      });
      response.pipe(outgoing);
    });
    request.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: "Webhook upstream unavailable" }));
    });
    incoming.pipe(request);
  });
}
