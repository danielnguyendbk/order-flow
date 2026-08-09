import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";

import { getNotificationWorkerConfig } from "./config/env.js";
import { dispatchPendingNotifications, startNotificationDispatcher } from "./notifications/dispatcher.js";
import { createNotificationQueue } from "./notifications/queue.js";
import { createNotificationWorker } from "./notifications/worker.js";

async function main(): Promise<void> {
  const config = getNotificationWorkerConfig();
  const database = new PrismaClient({ datasourceUrl: config.databaseUrl });
  const bot = new Telegraf(config.telegramBotToken);
  const queue = createNotificationQueue(config.redisUrl);
  const worker = createNotificationWorker(database, bot.telegram, config.redisUrl);

  await dispatchPendingNotifications(database, queue);
  const dispatcher = startNotificationDispatcher(database, queue);

  worker.on("completed", (job) => console.info(`Notification ${job.id} sent`));
  worker.on("failed", (job, error) => console.error(`Notification ${job?.id} failed`, error));

  async function shutdown(signal: string): Promise<void> {
    console.info(`${signal} received; stopping notification worker`);
    clearInterval(dispatcher);
    await worker.close();
    await queue.close();
    await database.$disconnect();
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal).finally(() => process.exit(0));
    });
  }
}

void main().catch((error) => {
  console.error("Notification worker failed to start", error);
  process.exitCode = 1;
});
