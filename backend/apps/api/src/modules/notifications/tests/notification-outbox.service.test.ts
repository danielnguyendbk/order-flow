import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { recordOrderNotification, recordPaymentReviewNotifications } from "../notification-outbox.service";

describe("notification outbox", () => {
  it("records the creator and every active barista when an order is paid", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        orderCode: "ORD-001",
        totalAmount: 85_000n,
        paymentMethod: "CASH",
        createdByUserId: "staff-1",
        creator: { telegramChatId: 123n, telegramUserId: 456n },
        items: [
          { itemName: "Cà phê sữa đá", quantity: 2, note: "Ít đá" },
          { itemName: "Trà đào", quantity: 1, note: null },
        ],
      }) },
      user: { findMany: vi.fn().mockResolvedValue([
        { id: "barista-1", telegramChatId: 789n, telegramUserId: 790n },
        { id: "barista-2", telegramChatId: null, telegramUserId: 791n },
      ]) },
      notification: {
        upsert: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
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
    expect(database.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: "BARISTA", status: "ACTIVE" }),
    }));
    expect(database.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          event: "ORDER_PAID",
          recipientUserId: "barista-1",
          recipientTelegramChatId: 789n,
          message: expect.stringContaining("2 × Cà phê sữa đá"),
        }),
        expect.objectContaining({ recipientUserId: "barista-2", recipientTelegramChatId: 791n }),
      ],
      skipDuplicates: true,
    });
  });

  it("still notifies baristas when the order creator has no Telegram destination", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue({
        id: "order-1", orderCode: "ORD-001", totalAmount: 30_000n, paymentMethod: "QR",
        createdByUserId: "staff-1", creator: { telegramChatId: null, telegramUserId: null },
        items: [{ itemName: "Trà đào", quantity: 1, note: null }],
      }) },
      user: { findMany: vi.fn().mockResolvedValue([
        { id: "barista-1", telegramChatId: 789n, telegramUserId: null },
      ]) },
      notification: { upsert: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    await recordOrderNotification(database as Prisma.TransactionClient, "ORDER_PAID", "order-1");

    expect(database.notification.upsert).not.toHaveBeenCalled();
    expect(database.notification.createMany).toHaveBeenCalledOnce();
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
