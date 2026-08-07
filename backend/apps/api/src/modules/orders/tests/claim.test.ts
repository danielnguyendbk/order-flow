import { beforeEach, describe, expect, it, vi } from "vitest";
import { FulfillmentStatus, PaymentStatus } from "../order.types";

// Mock Prisma Client
vi.mock("@prisma/client", () => {
  const mPrisma = {
    order: {
      update: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn().mockImplementation(() => mPrisma),
  };
});

import { PrismaClient } from "@prisma/client";
import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";

/**
 * Test suite for claiming orders by Baristas.
 */
describe("Order Claiming Lifecycle", () => {
  let orderService: OrderService;
  let orderRepositoryMock: any;
  let historyRepositoryMock: any;
  let paymentRepositoryMock: any;
  let prismaInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaInstance = new PrismaClient();
    orderRepositoryMock = {} as any;
    historyRepositoryMock = {
      create: vi.fn().mockResolvedValue({} as any),
    } as any;
    paymentRepositoryMock = {} as any;

    orderService = new OrderService(
      orderRepositoryMock,
      historyRepositoryMock,
      paymentRepositoryMock
    );
  });

  it("should allow an active barista to claim an unassigned order atomically", async () => {
    const mockUpdatedOrder = {
      id: "order-123",
      orderCode: "ORD-20260804-1111",
      createdByUserId: "user-1",
      assignedBaristaId: "barista-99",
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.PREPARING,
      totalAmount: 100000n,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock Prisma update to succeed (simulating atomic win)
    prismaInstance.order.update.mockResolvedValue(mockUpdatedOrder);

    const result = await orderService.claimOrder("order-123", "barista-99");

    // Assert database update filters on QUEUED, unassigned barista, and PAID status
    expect(prismaInstance.order.update).toHaveBeenCalledWith({
      where: {
        id: "order-123",
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        assignedBaristaId: null,
        paymentStatus: PaymentStatus.PAID,
      },
      data: {
        fulfillmentStatus: FulfillmentStatus.PREPARING,
        assignedBaristaId: "barista-99",
      },
      include: { items: true },
    });

    expect(result.assignedBaristaId).toBe("barista-99");
    expect(result.fulfillmentStatus).toBe(FulfillmentStatus.PREPARING);

    // Verify history audit log is created
    expect(historyRepositoryMock.create).toHaveBeenCalledWith({
      orderId: "order-123",
      statusDomain: "FULFILLMENT",
      oldStatus: FulfillmentStatus.QUEUED,
      newStatus: FulfillmentStatus.PREPARING,
      changedByUserId: "barista-99",
    });
  });

  it("should prevent claiming if the order is already claimed, unpaid, or not queued", async () => {
    // Mock Prisma update throwing error (simulating atomic collision)
    prismaInstance.order.update.mockRejectedValue(new Error("Record not found"));

    await expect(orderService.claimOrder("order-123", "barista-99")).rejects.toThrow(
      "Order cannot be claimed"
    );
  });
});

export const claimTestSuiteName = "Order Claiming Tests";
