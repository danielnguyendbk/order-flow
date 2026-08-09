import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { processNotification } from "./worker.js";

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notification-1",
    event: "ORDER_READY",
    status: "PENDING",
    sourceKey: "order-1",
    orderId: "order-1",
    recipientUserId: "staff-1",
    recipientTelegramChatId: 123456789012345678n,
    message: "Order ready",
    attemptCount: 0,
    lastError: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function database(record = notification()) {
  return {
    notification: {
      findUnique: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue(record),
    },
  } as any;
}

describe("notification worker processor", () => {
  it("sends to the snapshot chat id and marks the notification SENT", async () => {
    const db = database();
    const telegram = { sendMessage: vi.fn().mockResolvedValue({}) };

    await processNotification(db as PrismaClient, telegram, {
      data: { notificationId: "notification-1" }, attemptsMade: 0, opts: { attempts: 5 },
    } as any);

    expect(telegram.sendMessage).toHaveBeenCalledWith("123456789012345678", "Order ready");
    expect(db.notification.update).toHaveBeenLastCalledWith({
      where: { id: "notification-1" },
      data: { status: "SENT", attemptCount: 1, lastError: null, sentAt: expect.any(Date) },
    });
  });

  it("records RETRYING before the final attempt and rethrows Telegram errors", async () => {
    const db = database();
    const telegram = { sendMessage: vi.fn().mockRejectedValue(new Error("Telegram unavailable")) };

    await expect(processNotification(db as PrismaClient, telegram, {
      data: { notificationId: "notification-1" }, attemptsMade: 2, opts: { attempts: 5 },
    } as any)).rejects.toThrow("Telegram unavailable");
    expect(db.notification.update).toHaveBeenLastCalledWith({
      where: { id: "notification-1" },
      data: { status: "RETRYING", attemptCount: 3, lastError: "Telegram unavailable" },
    });
  });

  it("marks the fifth failed attempt FAILED", async () => {
    const db = database();
    const telegram = { sendMessage: vi.fn().mockRejectedValue(new Error("Unauthorized")) };
    await expect(processNotification(db as PrismaClient, telegram, {
      data: { notificationId: "notification-1" }, attemptsMade: 4, opts: { attempts: 5 },
    } as any)).rejects.toThrow("Unauthorized");
    expect(db.notification.update).toHaveBeenLastCalledWith({
      where: { id: "notification-1" },
      data: { status: "FAILED", attemptCount: 5, lastError: "Unauthorized" },
    });
  });

  it("does not send an already SENT notification", async () => {
    const db = database(notification({ status: "SENT" }));
    const telegram = { sendMessage: vi.fn() };
    await processNotification(db as PrismaClient, telegram, {
      data: { notificationId: "notification-1" }, attemptsMade: 0, opts: { attempts: 5 },
    } as any);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(db.notification.update).not.toHaveBeenCalled();
  });
});
