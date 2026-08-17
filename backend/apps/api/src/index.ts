import "./config/load-env";
import { createApp } from "./app";
import { QrPaymentPoller } from "./jobs/qr-payment-poller";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
const qrPaymentPoller = new QrPaymentPoller();

const server = app.listen(port, () => {
  console.log(`[order-flow-api] listening on http://localhost:${port}`);
  qrPaymentPoller.start();
});

function shutdown(): void {
  qrPaymentPoller.stop();
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
