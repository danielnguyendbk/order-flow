import { Queue } from "bullmq";

import type { NotificationJob } from "./types.js";

export const NOTIFICATION_QUEUE = "telegram-notifications";

export function createNotificationQueue(redisUrl: string): Queue<NotificationJob> {
  return new Queue<NotificationJob>(NOTIFICATION_QUEUE, {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}
