import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import { enqueueNotification } from "./queue.js";
import type { NotificationJob } from "./types.js";

export async function dispatchPendingNotifications(
  database: PrismaClient,
  queue: Queue<NotificationJob>,
  notBefore?: Date,
): Promise<number> {
  const notifications = await database.notification.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      ...(notBefore ? { createdAt: { gte: notBefore } } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  await Promise.all(notifications.map(({ id }) => enqueueNotification(queue, id)));
  return notifications.length;
}

export function startNotificationDispatcher(
  database: PrismaClient,
  queue: Queue<NotificationJob>,
  notBefore?: Date,
  intervalMs = 1_000,
): NodeJS.Timeout {
  let dispatching = false;
  return setInterval(() => {
    if (dispatching) return;
    dispatching = true;
    void dispatchPendingNotifications(database, queue, notBefore)
      .catch((error) => console.error("Notification dispatch failed", error))
      .finally(() => { dispatching = false; });
  }, intervalMs);
}
