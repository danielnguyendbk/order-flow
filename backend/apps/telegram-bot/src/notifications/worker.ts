import type { PrismaClient } from "@prisma/client";
import { Worker, type Job } from "bullmq";

import { NOTIFICATION_QUEUE } from "./queue.js";
import type { NotificationJob } from "./types.js";

export interface TelegramSender {
  sendMessage(chatId: string, message: string): Promise<unknown>;
}

type NotificationJobContext = Pick<Job<NotificationJob>, "data" | "attemptsMade" | "opts">;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createNotificationWorker(
  database: PrismaClient,
  telegram: TelegramSender,
  redisUrl: string,
): Worker<NotificationJob> {
  return new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    (job) => processNotification(database, telegram, job),
    { connection: { url: redisUrl }, concurrency: 5 },
  );
}

export async function processNotification(
  database: PrismaClient,
  telegram: TelegramSender,
  job: NotificationJobContext,
): Promise<void> {
  const notification = await database.notification.findUnique({ where: { id: job.data.notificationId } });
  if (!notification) throw new Error(`Notification ${job.data.notificationId} does not exist`);
  if (notification.status === "SENT") return;

  const attemptCount = job.attemptsMade + 1;
  await database.notification.update({
    where: { id: notification.id },
    data: { status: "RETRYING", attemptCount, lastError: null },
  });

  try {
    await telegram.sendMessage(notification.recipientTelegramChatId.toString(), notification.message);
    await database.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", attemptCount, lastError: null, sentAt: new Date() },
    });
  } catch (error) {
    const maximumAttempts = Number(job.opts.attempts ?? 1);
    await database.notification.update({
      where: { id: notification.id },
      data: {
        status: attemptCount >= maximumAttempts ? "FAILED" : "RETRYING",
        attemptCount,
        lastError: errorMessage(error).slice(0, 4_000),
      },
    });
    throw error;
  }
}
