import { PrismaClient } from "@prisma/client";

import { getNotificationWorkerConfig } from "../config/env.js";
import { createNotificationQueue, enqueueNotification } from "./queue.js";

async function main(): Promise<void> {
  const notificationId = process.argv[2]?.trim();
  if (!notificationId) throw new Error("Usage: npm.cmd run notifications:requeue -- <notification-id>");

  const config = getNotificationWorkerConfig();
  const database = new PrismaClient({ datasourceUrl: config.databaseUrl });
  const queue = createNotificationQueue(config.redisUrl);

  try {
    const notification = await database.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new Error(`Notification ${notificationId} does not exist`);
    if (notification.status !== "FAILED") {
      throw new Error(`Notification ${notificationId} must be FAILED before it can be requeued`);
    }

    const existingJob = await queue.getJob(notificationId);
    if (existingJob) await existingJob.remove();
    await database.notification.update({
      where: { id: notificationId },
      data: { status: "PENDING", attemptCount: 0, lastError: null, sentAt: null },
    });
    await enqueueNotification(queue, notificationId);
    console.info(`Notification ${notificationId} requeued`);
  } finally {
    await queue.close();
    await database.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
