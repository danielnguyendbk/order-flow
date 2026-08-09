import { resolve } from "node:path";

import { loadLocalEnvironment } from "./config/local-env.js";

type DevelopmentTarget = "bot" | "notification-worker" | "notifications-requeue";

async function main(): Promise<void> {
  const target = process.argv[2] as DevelopmentTarget | undefined;
  process.argv.splice(2, 1);

  loadLocalEnvironment(resolve(__dirname, "../.env"));

  if (target === "bot") {
    await import("./index.js");
    return;
  }
  if (target === "notification-worker") {
    await import("./worker.js");
    return;
  }
  if (target === "notifications-requeue") {
    await import("./notifications/requeue.js");
    return;
  }

  throw new Error("Usage: dev-runner <bot|notification-worker|notifications-requeue>");
}

void main().catch((error) => {
  console.error("Telegram development process failed to start", error);
  process.exitCode = 1;
});
