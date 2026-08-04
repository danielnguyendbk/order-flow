import { Worker } from "bullmq";
import type { Telegraf } from "telegraf";

import { NOTIFICATION_QUEUE } from "./queue.js";
import type { NotificationJob } from "./types.js";
import type { BotContext } from "../types.js";

export function createNotificationWorker(bot: Telegraf<BotContext>, redisUrl: string): Worker<NotificationJob> {
  return new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    async (job) => {
      await bot.telegram.sendMessage(job.data.recipientTelegramUserId, job.data.message);
    },
    { connection: { url: redisUrl }, concurrency: 5 },
  );
}
