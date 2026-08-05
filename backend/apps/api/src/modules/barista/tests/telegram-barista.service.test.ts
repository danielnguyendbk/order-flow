import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { TelegramBaristaService } from "../telegram-barista.service";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderCode: "ORD-001",
    createdByUserId: "staff-1",
    assignedBaristaId: null,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    fulfillmentStatus: "QUEUED",
    totalAmount: 30_000n,
    customerNote: null,
    cancellationReason: null,
    paidAt: new Date("2026-08-05T00:00:00.000Z"),
    createdAt: new Date("2026-08-05T00:00:00.000Z"),
    updatedAt: new Date("2026-08-05T00:00:00.000Z"),
    items: [{ id: "line-1", orderId: "order-1", menuItemId: "item-1", itemName: "Trà đào", unitPrice: 30_000n, quantity: 1, note: null }],
    ...overrides,
  };
}

function database() {
  const db: any = {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  db.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(db));
  return db;
}

describe("TelegramBaristaService", () => {
  it("queries only paid, unassigned QUEUED orders oldest first", async () => {
    const db = database();
    db.order.findMany.mockResolvedValue([order()]);
    const result = await new TelegramBaristaService(db as PrismaClient).listQueue();
    expect(db.order.findMany).toHaveBeenCalledWith({
      where: { paymentStatus: "PAID", fulfillmentStatus: "QUEUED", assignedBaristaId: null },
      include: { items: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    expect(result[0]).toMatchObject({ code: "ORD-001", fulfillmentStatus: "QUEUED" });
  });

  it("claims conditionally and records history in the same transaction", async () => {
    const db = database();
    db.order.findUnique
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(order({ assignedBaristaId: "barista-1", fulfillmentStatus: "PREPARING" }));
    const result = await new TelegramBaristaService(db as PrismaClient).claim("barista-1", "order-1");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", paymentStatus: "PAID", fulfillmentStatus: "QUEUED", assignedBaristaId: null },
      data: { fulfillmentStatus: "PREPARING", assignedBaristaId: "barista-1" },
    });
    expect(db.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldStatus: "QUEUED", newStatus: "PREPARING", changedByUserId: "barista-1" }) });
    expect(result.fulfillmentStatus).toBe("PREPARING");
  });

  it("rejects READY from a barista who does not own the order", async () => {
    const db = database();
    db.order.findUnique.mockResolvedValue(order({ assignedBaristaId: "barista-2", fulfillmentStatus: "PREPARING" }));
    await expect(new TelegramBaristaService(db as PrismaClient).markReady("barista-1", "order-1"))
      .rejects.toMatchObject({ statusCode: 403, code: "ORDER_FORBIDDEN" });
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("marks an owned PREPARING order READY and records history atomically", async () => {
    const db = database();
    db.order.findUnique
      .mockResolvedValueOnce(order({ assignedBaristaId: "barista-1", fulfillmentStatus: "PREPARING" }))
      .mockResolvedValueOnce(order({ assignedBaristaId: "barista-1", fulfillmentStatus: "READY" }));
    const result = await new TelegramBaristaService(db as PrismaClient).markReady("barista-1", "order-1");
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", assignedBaristaId: "barista-1", fulfillmentStatus: "PREPARING" },
      data: { fulfillmentStatus: "READY" },
    });
    expect(db.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldStatus: "PREPARING", newStatus: "READY" }) });
    expect(result.fulfillmentStatus).toBe("READY");
  });
});
