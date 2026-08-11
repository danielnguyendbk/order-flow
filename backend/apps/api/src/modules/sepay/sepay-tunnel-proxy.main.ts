import { createSepayTunnelProxy } from "./sepay-tunnel-proxy.js";

const host = "127.0.0.1";
const port = Number(process.env.SEPAY_TUNNEL_PROXY_PORT ?? 3011);
const server = createSepayTunnelProxy();

server.listen(port, host, () => {
  console.info(`SePay tunnel proxy listening on http://${host}:${port}/api/v1/webhooks/sepay`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
