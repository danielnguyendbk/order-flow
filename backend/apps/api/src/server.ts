import { createServer } from "node:http";

import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();
const app = createApp();
const server = createServer(app);

async function shutdown(signal: string): Promise<void> {
  console.info({ signal }, "Shutting down API");
  server.close(async () => {
    await app.locals.dispose();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

server.listen(env.PORT, env.HOST, () => {
  console.info(`Order Flow API listening on http://${env.HOST}:${env.PORT}`);
});
