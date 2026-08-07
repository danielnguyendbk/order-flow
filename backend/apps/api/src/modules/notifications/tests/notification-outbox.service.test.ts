import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { recordOrderNotification, recordPaymentReviewNotifications } from "../notification-outbox.service";

describe("notification outbox", () => {
  it("records a creator notification idempotently and prefers chat id", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        orderCode: "ORD-001",
        createdByUserId: "staff-1",
        creator: { telegramChatId: 123n, telegramUserId: 456n },
      }) },
      notification: { upsert: vi.fn().mockResolvedValue({}) },
    };

    await recordOrderNotification(database as Prisma.TransactionClient, "ORDER_PAID", "order-1");

    expect(database.notification.upsert).toHaveBeenCalledWith({
      where: { event_sourceKey_recipientUserId: {
        event: "ORDER_PAID", sourceKey: "order-1", recipientUserId: "staff-1",
      } },
      create: expect.objectContaining({
        event: "ORDER_PAID",
        sourceKey: "order-1",
        orderId: "order-1",
        recipientUserId: "staff-1",
        recipientTelegramChatId: 123n,
        message: "✅ Đơn ORD-001 đã được thanh toán và đang chờ pha.",
      }),
      update: {},
    });
  });

  it("skips an order notification when the creator has no Telegram destination", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue({
        id: "order-1", orderCode: "ORD-001", createdByUserId: "staff-1",
        creator: { telegramChatId: null, telegramUserId: null },
      }) },
      notification: { upsert: vi.fn() },
    };
    await recordOrderNotification(database as Prisma.TransactionClient, "ORDER_READY", "order-1");
    expect(database.notification.upsert).not.toHaveBeenCalled();
  });

  it("creates one PAYMENT_REVIEW record per active owner with a Telegram destination", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([
        { id: "owner-1", telegramChatId: null, telegramUserId: 100n },
        { id: "owner-2", telegramChatId: 200n, telegramUserId: 201n },
      ]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };

    await expect(recordPaymentReviewNotifications(database as Prisma.TransactionClient, {
      sourceKey: "sepay-99", orderId: "order-1",
    })).resolves.toBe(2);
    expect(database.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ event: "PAYMENT_REVIEW", recipientUserId: "owner-1", recipientTelegramChatId: 100n }),
        expect.objectContaining({ event: "PAYMENT_REVIEW", recipientUserId: "owner-2", recipientTelegramChatId: 200n }),
      ],
      skipDuplicates: true,
    });
  });
});
