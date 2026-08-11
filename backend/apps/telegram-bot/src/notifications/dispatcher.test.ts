import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { dispatchPendingNotifications } from "./dispatcher.js";
import type { NotificationJob } from "./types.js";

describe("notification dispatcher", () => {
  it("scans only dispatchable outbox rows and uses the notification id as BullMQ job id", async () => {
    const database: any = {
      notification: { findMany: vi.fn().mockResolvedValue([{ id: "notification-1" }, { id: "notification-2" }]) },
    };
    const queue: any = { add: vi.fn().mockResolvedValue({}) };

    await expect(dispatchPendingNotifications(
      database as PrismaClient,
      queue as Queue<NotificationJob>,
    )).resolves.toBe(2);

    expect(database.notification.findMany).toHaveBeenCalledWith({
      where: { status: { in: ["PENDING", "RETRYING"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    expect(queue.add).toHaveBeenCalledWith(
      "telegram-notification",
      { notificationId: "notification-1" },
      { jobId: "notification-1" },
    );
  });

  it("applies a local cutoff without changing pending historical rows", async () => {
    const database: any = { notification: { findMany: vi.fn().mockResolvedValue([]) } };
    const queue: any = { add: vi.fn() };
    const notBefore = new Date("2026-08-10T14:30:00.000Z");

    await dispatchPendingNotifications(database as PrismaClient, queue as Queue<NotificationJob>, notBefore);

    expect(database.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: { in: ["PENDING", "RETRYING"] },
        createdAt: { gte: notBefore },
      },
    }));
    expect(queue.add).not.toHaveBeenCalled();
  });
});
