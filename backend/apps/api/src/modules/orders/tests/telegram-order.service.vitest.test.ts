import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { TelegramOrderService } from "../telegram-order.service";

const unusedDatabase = {} as PrismaClient;

describe("TelegramOrderService input guards", () => {
  const pendingQrOrder = {
    id: "order-qr", orderCode: "ORD-20260810-9950", createdByUserId: "staff-1", assignedBaristaId: null,
    paymentMethod: "QR", paymentStatus: "PENDING", fulfillmentStatus: "PENDING_PAYMENT", totalAmount: 5_000n,
    customerNote: null, cancellationReason: null, paidAt: null, createdAt: new Date("2026-08-10T15:36:00Z"), updatedAt: new Date(), items: [],
  } as const;

  it("returns the employee's existing open draft without creating a duplicate", async () => {
    const existing = {
      id: "order-1", orderCode: "ORD-001", createdByUserId: "staff-1", assignedBaristaId: null,
      paymentMethod: null, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT", totalAmount: 0n,
      customerNote: null, cancellationReason: null, paidAt: null, createdAt: new Date(), updatedAt: new Date(), items: [],
    };
    const database: any = {
      order: { findFirst: vi.fn().mockResolvedValue(existing), create: vi.fn() },
      orderStatusHistory: { create: vi.fn() },
    };
    database.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(database));

    const result = await new TelegramOrderService(database as PrismaClient).createDraft("staff-1");

    expect(result).toMatchObject({ id: "order-1", paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT" });
    expect(database.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdByUserId: "staff-1", paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT" },
    }));
    expect(database.order.create).not.toHaveBeenCalled();
    expect(database.orderStatusHistory.create).not.toHaveBeenCalled();
  });

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

  it("resets a pending QR payment before any transaction is received", async () => {
    const resetOrder = { ...pendingQrOrder, paymentMethod: null, paymentStatus: "UNPAID" };
    const database: any = {
      order: {
        findUnique: vi.fn().mockResolvedValueOnce(pendingQrOrder).mockResolvedValueOnce(resetOrder),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findUnique: vi.fn().mockResolvedValue({ id: "payment-1", receivedAmount: 0n, _count: { sepayTransactions: 0 } }),
        delete: vi.fn().mockResolvedValue({}),
      },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    database.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(database));

    const result = await new TelegramOrderService(database as PrismaClient).resetQr("staff-1", "order-qr");

    expect(database.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { paymentMethod: null, paymentStatus: "UNPAID" },
    }));
    expect(database.payment.delete).toHaveBeenCalledWith({ where: { id: "payment-1" } });
    expect(database.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldStatus: "PENDING", newStatus: "UNPAID" }) });
    expect(result).toMatchObject({ paymentMethod: null, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT" });
  });

  it("does not reset QR after a transaction has been received", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue(pendingQrOrder), updateMany: vi.fn() },
      payment: { findUnique: vi.fn().mockResolvedValue({ id: "payment-1", receivedAmount: 5_000n, _count: { sepayTransactions: 1 } }), delete: vi.fn() },
    };
    database.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(database));

    await expect(new TelegramOrderService(database as PrismaClient).resetQr("staff-1", "order-qr"))
      .rejects.toMatchObject({ statusCode: 409, code: "QR_PAYMENT_RECEIVED" });
    expect(database.order.updateMany).not.toHaveBeenCalled();
    expect(database.payment.delete).not.toHaveBeenCalled();
  });

  it("does not change a pending order when SePay has no exact transaction", async () => {
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValue(pendingQrOrder) },
      payment: { findUnique: vi.fn().mockResolvedValue({ paymentCode: "PAY2608109950", expectedAmount: 5_000n, createdAt: pendingQrOrder.createdAt }) },
    };
    const lookup = { findIncomingTransaction: vi.fn().mockResolvedValue(null) };
    const sepayService = { handleTrustedTransaction: vi.fn() };
    const service = new TelegramOrderService(database as PrismaClient, { accountNumber: "0337990731", bankName: "MB" }, lookup, sepayService as any);

    await expect(service.reconcileQr("staff-1", "order-qr")).resolves.toMatchObject({ matched: false, order: { paymentStatus: "PENDING" } });
    expect(lookup.findIncomingTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: 5_000n, paymentCode: "PAY2608109950" }));
    expect(sepayService.handleTrustedTransaction).not.toHaveBeenCalled();
  });

  it("processes an exact SePay API transaction through the webhook reconciliation service", async () => {
    const paidOrder = { ...pendingQrOrder, paymentStatus: "PAID", fulfillmentStatus: "QUEUED", paidAt: new Date() };
    const database: any = {
      order: { findUnique: vi.fn().mockResolvedValueOnce(pendingQrOrder).mockResolvedValueOnce(paidOrder) },
      payment: { findUnique: vi.fn().mockResolvedValue({ paymentCode: "PAY2608109950", expectedAmount: 5_000n, createdAt: pendingQrOrder.createdAt }) },
    };
    const transaction = { id: "123", content: "PAY2608109950", transferAmount: "5000" };
    const lookup = { findIncomingTransaction: vi.fn().mockResolvedValue(transaction) };
    const sepayService = { handleTrustedTransaction: vi.fn().mockResolvedValue({ matched: true }) };
    const service = new TelegramOrderService(database as PrismaClient, { accountNumber: "0337990731", bankName: "MB" }, lookup, sepayService as any);

    await expect(service.reconcileQr("staff-1", "order-qr")).resolves.toMatchObject({ matched: true, order: { paymentStatus: "PAID", fulfillmentStatus: "QUEUED" } });
    expect(sepayService.handleTrustedTransaction).toHaveBeenCalledWith(transaction);
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
