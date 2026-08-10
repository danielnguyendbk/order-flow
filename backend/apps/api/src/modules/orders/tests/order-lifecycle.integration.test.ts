import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";
import { OrderRepository } from "../order.repository";
import { OrderService } from "../order.service";
import { FulfillmentStatus, PaymentStatus } from "../order.types";

vi.mock("@prisma/client", () => {
  const mPrisma = {
    order: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    menuItem: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  function PrismaClientMock() {
    return mPrisma;
  }

  return {
    PrismaClient: PrismaClientMock,
  };
});

describe("Order lifecycle integration", () => {
  let prismaInstance: any;
  let orderRepositoryMock: jest.Mocked<OrderRepository>;
  let historyRepositoryMock: jest.Mocked<HistoryRepository>;
  let paymentRepositoryMock: jest.Mocked<PaymentRepository>;
  let service: OrderService;
  let currentOrder: any;

  function recalculateTotal(items: Array<{ unitPrice: bigint; quantity: number }>): bigint {
    return items.reduce((sum, item) => sum + item.unitPrice * BigInt(item.quantity), 0n);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaInstance = new PrismaClient();
    currentOrder = {
      id: "order-1",
      orderCode: "ORD-20260808-0001",
      createdByUserId: "customer-1",
      assignedBaristaId: null,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      totalAmount: 0n,
      items: [],
      createdAt: new Date("2026-08-08T00:00:00.000Z"),
      updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    };

    prismaInstance.order.update.mockImplementation(async ({ data }: { data: any }) => {
      currentOrder = { ...currentOrder, ...data };
      return currentOrder;
    });
    prismaInstance.order.updateMany.mockImplementation(async ({ data }: { data: any }) => {
      currentOrder = { ...currentOrder, ...data };
      return { count: 1 };
    });
    prismaInstance.order.findUnique.mockImplementation(async () => currentOrder);
    prismaInstance.menuItem.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "menu-1") {
        return { id: "menu-1", name: "Coffee", price: 20_000n, isAvailable: true, category: { id: "cat-1", name: "Drinks", isActive: true } };
      }
      if (where.id === "menu-2") {
        return { id: "menu-2", name: "Milk Tea", price: 20_000n, isAvailable: true, category: { id: "cat-1", name: "Drinks", isActive: true } };
      }
      return null;
    });
    prismaInstance.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "barista-1") return { id: "barista-1", role: "BARISTA" };
      if (where.id === "manager-1") return { id: "manager-1", role: "OWNER" };
      if (where.id === "customer-1") return { id: "customer-1", role: "SERVICE_STAFF" };
      if (where.id === "other-user") return { id: "other-user", role: "BARISTA" };
      return null;
    });

    orderRepositoryMock = {
      findById: vi.fn().mockImplementation(async () => currentOrder),
      findItemById: vi.fn().mockResolvedValue({ id: "item-1", orderId: "order-1" } as any),
      create: vi.fn().mockImplementation(async (_createdByUserId, _paymentMethod, _customerNote, items) => {
        const withIds = items.map((item: any, index: number) => ({ ...item, id: `item-${index + 1}` }));
        currentOrder = {
          ...currentOrder,
          createdByUserId: "customer-1",
          paymentStatus: PaymentStatus.UNPAID,
          fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
          items: withIds,
          totalAmount: withIds.reduce((sum: bigint, item: any) => sum + item.unitPrice * BigInt(item.quantity), 0n),
        };
        return currentOrder;
      }),
      updateFulfillmentStatus: vi.fn().mockImplementation(async (_orderId, fulfillmentStatus, opts) => {
        currentOrder = {
          ...currentOrder,
          fulfillmentStatus,
          ...(opts?.cancellationReason ? { cancellationReason: opts.cancellationReason } : {}),
          ...(opts?.assignedBaristaId ? { assignedBaristaId: opts.assignedBaristaId } : {}),
        };
        return currentOrder;
      }),
      updatePaymentStatus: vi.fn().mockImplementation(async (_orderId, paymentStatus, opts) => {
        currentOrder = {
          ...currentOrder,
          paymentStatus,
          ...(opts?.paidAt ? { paidAt: opts.paidAt } : {}),
        };
        return currentOrder;
      }),
      addItem: vi.fn().mockImplementation(async (_orderId, item) => {
        const nextItems = [
          ...currentOrder.items,
          { id: `item-${currentOrder.items.length + 1}`, orderId: currentOrder.id, ...item },
        ];
        currentOrder = {
          ...currentOrder,
          items: nextItems,
          totalAmount: recalculateTotal(nextItems),
        };
        return currentOrder;
      }),
      updateItem: vi.fn().mockImplementation(async (_orderId, itemId, input) => {
        const nextItems = currentOrder.items.map((item: any) =>
          item.id === itemId
            ? { ...item, ...(input.quantity !== undefined ? { quantity: input.quantity } : {}), ...(input.note !== undefined ? { note: input.note } : {}) }
            : item,
        );
        currentOrder = {
          ...currentOrder,
          items: nextItems,
          totalAmount: recalculateTotal(nextItems),
        };
        return currentOrder;
      }),
      deleteItem: vi.fn().mockImplementation(async (_orderId, itemId) => {
        const nextItems = currentOrder.items.filter((item: any) => item.id !== itemId);
        currentOrder = {
          ...currentOrder,
          items: nextItems,
          totalAmount: recalculateTotal(nextItems),
        };
        return currentOrder;
      }),
    } as any;
    historyRepositoryMock = {
      create: vi.fn().mockResolvedValue({} as any),
    } as any;
    paymentRepositoryMock = {
      createForOrder: vi.fn().mockResolvedValue({} as any),
    } as any;

    service = new OrderService(orderRepositoryMock, historyRepositoryMock, paymentRepositoryMock);
  });

  it("covers draft creation, editing, totals and cancellation", async () => {
    const created = await service.createOrder({
      createdByUserId: "customer-1",
      items: [{ menuItemId: "menu-1", itemName: "Coffee", unitPrice: 20_000n, quantity: 1 }],
    });

    expect(created.fulfillmentStatus).toBe(FulfillmentStatus.PENDING_PAYMENT);
    expect(created.totalAmount).toBe(20_000n);

    const added = await service.addItem("order-1", { menuItemId: "menu-2", quantity: 2, note: "Less ice" });
    expect(added.totalAmount).toBe(60_000n);

    const updated = await service.updateItem("order-1", "item-1", { quantity: 3, note: "Extra shot" });
    expect(updated.totalAmount).toBe(100_000n);

    const deleted = await service.deleteItem("order-1", "item-2");
    expect(deleted.totalAmount).toBe(60_000n);
    expect(deleted.items).toHaveLength(1);

    const cancelled = await service.cancelOrder("order-1", "Changed my mind", "customer-1");
    expect(cancelled.fulfillmentStatus).toBe(FulfillmentStatus.CANCELLED);
    expect(historyRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "order-1",
      statusDomain: "FULFILLMENT",
      newStatus: FulfillmentStatus.CANCELLED,
      changedByUserId: "customer-1",
    }));
  });

  it("covers concurrent claim, ready, delivered and invalid transitions", async () => {
    currentOrder = {
      ...currentOrder,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      items: [{ id: "item-1", orderId: "order-1", menuItemId: "menu-1", itemName: "Coffee", unitPrice: 20_000n, quantity: 1 }],
      totalAmount: 20_000n,
    };

    prismaInstance.order.update.mockImplementation(async ({ where, data }: { where: any; data: any }) => {
      if (
        currentOrder.fulfillmentStatus !== FulfillmentStatus.QUEUED ||
        currentOrder.assignedBaristaId !== null ||
        currentOrder.paymentStatus !== PaymentStatus.PAID
      ) {
        throw new Error("Record not found");
      }
      currentOrder = {
        ...currentOrder,
        fulfillmentStatus: data.fulfillmentStatus,
        assignedBaristaId: data.assignedBaristaId,
      };
      return { ...currentOrder, items: currentOrder.items };
    });

    const claimResults = await Promise.allSettled([
      service.claimOrder("order-1", "barista-1"),
      service.claimOrder("order-1", "barista-2"),
    ]);
    expect(claimResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(claimResults.filter((result) => result.status === "rejected")).toHaveLength(1);

    await expect(service.markReady("order-1", "other-user")).rejects.toMatchObject({ statusCode: 403 });
    const ready = await service.markReady("order-1", "barista-1");
    expect(ready.fulfillmentStatus).toBe(FulfillmentStatus.READY);

    await expect(service.deliverOrder("order-1", "other-user")).rejects.toMatchObject({ statusCode: 403 });
    const delivered = await service.deliverOrder("order-1", "customer-1");
    expect(delivered.fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);

    await expect(service.claimOrder("order-1", "barista-1")).rejects.toThrow("Order cannot be claimed");
    await expect(service.markReady("order-1", "barista-1")).rejects.toThrow("Cannot mark order as READY from DELIVERED status");
  });
});
