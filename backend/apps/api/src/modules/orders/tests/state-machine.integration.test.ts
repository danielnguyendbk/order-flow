import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";
import { FulfillmentStatus, PaymentStatus } from "../order.types";

jest.mock("@prisma/client", () => {
  const mPrisma = {
    order: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
  };
});

import { PrismaClient } from "@prisma/client";

describe("Order fulfillment state machine integration", () => {
  let prismaInstance: any;
  let orderRepositoryMock: jest.Mocked<OrderRepository>;
  let historyRepositoryMock: jest.Mocked<HistoryRepository>;
  let paymentRepositoryMock: jest.Mocked<PaymentRepository>;
  let service: OrderService;
  let currentOrder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaInstance = new PrismaClient();
    currentOrder = {
      id: "order-1",
      orderCode: "ORD-20260807-1234",
      createdByUserId: "customer-1",
      assignedBaristaId: null,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      totalAmount: 65000n,
      items: [],
      createdAt: new Date("2026-08-07T00:00:00.000Z"),
      updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    };

    prismaInstance.order.update.mockImplementation(async ({ data }: { data: any }) => {
      currentOrder = { ...currentOrder, ...data };
      return currentOrder;
    });

    prismaInstance.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "barista-1") return { id: "barista-1", role: "BARISTA" };
      if (where.id === "customer-1") return { id: "customer-1", role: "BARISTA" };
      return null;
    });

    orderRepositoryMock = {
      findById: jest.fn().mockImplementation(async () => currentOrder),
      updateFulfillmentStatus: jest.fn().mockImplementation(async (_orderId, fulfillmentStatus, opts) => {
        currentOrder = {
          ...currentOrder,
          fulfillmentStatus,
          ...(opts?.cancellationReason ? { cancellationReason: opts.cancellationReason } : {}),
        };
        return currentOrder;
      }),
      updatePaymentStatus: jest.fn(),
    } as any;
    historyRepositoryMock = {
      create: jest.fn().mockResolvedValue({} as any),
    } as any;
    paymentRepositoryMock = {} as any;

    service = new OrderService(orderRepositoryMock, historyRepositoryMock, paymentRepositoryMock);
  });

  it("records every fulfillment transition from queue to delivery", async () => {
    const claimed = await service.claimOrder("order-1", "barista-1");
    expect(claimed.fulfillmentStatus).toBe(FulfillmentStatus.PREPARING);

    const ready = await service.markReady("order-1", "barista-1");
    expect(ready.fulfillmentStatus).toBe(FulfillmentStatus.READY);

    const delivered = await service.deliverOrder("order-1", "customer-1");
    expect(delivered.fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);

    expect(historyRepositoryMock.create).toHaveBeenNthCalledWith(1, {
      orderId: "order-1",
      statusDomain: "FULFILLMENT",
      oldStatus: FulfillmentStatus.QUEUED,
      newStatus: FulfillmentStatus.PREPARING,
      changedByUserId: "barista-1",
    });
    expect(historyRepositoryMock.create).toHaveBeenNthCalledWith(2, {
      orderId: "order-1",
      statusDomain: "FULFILLMENT",
      oldStatus: FulfillmentStatus.PREPARING,
      newStatus: FulfillmentStatus.READY,
      changedByUserId: "barista-1",
    });
    expect(historyRepositoryMock.create).toHaveBeenNthCalledWith(3, {
      orderId: "order-1",
      statusDomain: "FULFILLMENT",
      oldStatus: FulfillmentStatus.READY,
      newStatus: FulfillmentStatus.DELIVERED,
      changedByUserId: "customer-1",
    });
  });

  it.each([
    [FulfillmentStatus.QUEUED, "customer-1", "Cannot deliver an order in QUEUED status. Order must be READY."],
    [FulfillmentStatus.PREPARING, "customer-1", "Cannot deliver an order in PREPARING status. Order must be READY."],
  ])("rejects invalid delivery transition from %s", async (status, requesterId, message) => {
    currentOrder = {
      ...currentOrder,
      fulfillmentStatus: status,
    };

    await expect(service.deliverOrder("order-1", requesterId as string)).rejects.toThrow(message as string);
    expect(historyRepositoryMock.create).not.toHaveBeenCalled();
  });

  it("rejects invalid ready transition when order is still queued", async () => {
    currentOrder = {
      ...currentOrder,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      assignedBaristaId: "barista-1",
    };

    await expect(service.markReady("order-1", "barista-1")).rejects.toThrow(
      "Cannot mark order as READY from QUEUED status",
    );
    expect(historyRepositoryMock.create).not.toHaveBeenCalled();
  });
});
