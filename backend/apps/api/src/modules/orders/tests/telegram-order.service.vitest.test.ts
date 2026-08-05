import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { TelegramOrderService } from "../telegram-order.service";

const unusedDatabase = {} as PrismaClient;

describe("TelegramOrderService input guards", () => {
  it("rejects client quantities outside the Telegram contract before database access", async () => {
    const service = new TelegramOrderService(unusedDatabase);
    await expect(service.addItem("employee", "order", { menuItemId: "item", quantity: 0 })).rejects.toMatchObject({ code: "QUANTITY_INVALID" });
    await expect(service.addItem("employee", "order", { menuItemId: "item", quantity: 100 })).rejects.toMatchObject({ code: "QUANTITY_INVALID" });
  });

  it("rejects an empty item update before database access", async () => {
    const service = new TelegramOrderService(unusedDatabase);
    await expect(service.updateItem("employee", "order", "item", {})).rejects.toMatchObject({ code: "ITEM_UPDATE_EMPTY" });
  });

  it("fails QR creation explicitly when bank configuration is missing", async () => {
    const service = new TelegramOrderService(unusedDatabase, { accountNumber: "", bankName: "" });
    await expect(service.createQr("employee", "order")).rejects.toMatchObject({ statusCode: 503, code: "QR_CONFIG_MISSING" });
  });

  it("delivers an owned READY order and records the transition atomically", async () => {
    const current = {
      id: "order-1",
      orderCode: "ORD-001",
      createdByUserId: "staff-1",
      assignedBaristaId: "barista-1",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      fulfillmentStatus: "READY",
      totalAmount: 30_000n,
      customerNote: null,
      cancellationReason: null,
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };
    const database: any = {
      order: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce({ ...current, fulfillmentStatus: "DELIVERED" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    database.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(database));

    const result = await new TelegramOrderService(database as PrismaClient).deliver("staff-1", "order-1");
    expect(database.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", createdByUserId: "staff-1", fulfillmentStatus: "READY" },
      data: { fulfillmentStatus: "DELIVERED" },
    });
    expect(database.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldStatus: "READY", newStatus: "DELIVERED", changedByUserId: "staff-1" }) });
    expect(result.fulfillmentStatus).toBe("DELIVERED");
  });

  it("rejects delivery by a different service-staff identity", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue({
        id: "order-1", orderCode: "ORD-001", createdByUserId: "staff-2", assignedBaristaId: "barista-1",
        paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "READY", totalAmount: 30_000n,
        customerNote: null, cancellationReason: null, paidAt: new Date(), createdAt: new Date(), updatedAt: new Date(), items: [],
      }) },
      orderStatusHistory: { create: vi.fn() },
    };
    database.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(database));
    await expect(new TelegramOrderService(database as PrismaClient).deliver("staff-1", "order-1"))
      .rejects.toMatchObject({ statusCode: 403, code: "ORDER_FORBIDDEN" });
  });
});
