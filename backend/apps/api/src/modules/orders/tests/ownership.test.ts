import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";
import { FulfillmentStatus, PaymentStatus } from "../order.types";

// Mock Prisma Client
jest.mock("@prisma/client", () => {
  const mPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
  };
});

import { PrismaClient } from "@prisma/client";

/**
 * Test suite for verifying order ownership constraints and assignments.
 */
describe("Order Ownership and Authorization", () => {
  let orderService: OrderService;
  let orderRepositoryMock: jest.Mocked<OrderRepository>;
  let historyRepositoryMock: jest.Mocked<HistoryRepository>;
  let paymentRepositoryMock: jest.Mocked<PaymentRepository>;
  let prismaInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaInstance = new PrismaClient();
    orderRepositoryMock = {
      findById: jest.fn(),
      updateFulfillmentStatus: jest.fn(),
    } as any;
    historyRepositoryMock = {
      create: jest.fn().mockResolvedValue({} as any),
    } as any;
    paymentRepositoryMock = {} as any;

    orderService = new OrderService(
      orderRepositoryMock,
      historyRepositoryMock,
      paymentRepositoryMock
    );
  });

  describe("markReady", () => {
    const mockOrder = {
      id: "order-1",
      assignedBaristaId: "barista-assigned",
      fulfillmentStatus: FulfillmentStatus.PREPARING,
      paymentStatus: PaymentStatus.PAID,
    };

    it("should allow the assigned barista to mark order as READY", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "barista-assigned", role: "BARISTA" });
      orderRepositoryMock.updateFulfillmentStatus.mockResolvedValue({} as any);

      await orderService.markReady("order-1", "barista-assigned");

      expect(orderRepositoryMock.updateFulfillmentStatus).toHaveBeenCalledWith("order-1", FulfillmentStatus.READY);
    });

    it("should allow a manager (OWNER/SERVICE_STAFF) to mark order as READY even if not assigned", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "manager-1", role: "OWNER" });
      orderRepositoryMock.updateFulfillmentStatus.mockResolvedValue({} as any);

      await orderService.markReady("order-1", "manager-1");

      expect(orderRepositoryMock.updateFulfillmentStatus).toHaveBeenCalledWith("order-1", FulfillmentStatus.READY);
    });

    it("should block a non-assigned barista from marking order as READY", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "barista-other", role: "BARISTA" });

      await expect(orderService.markReady("order-1", "barista-other")).rejects.toThrow(
        "Only the assigned barista or a manager can mark this order as READY"
      );
    });
  });

  describe("deliverOrder", () => {
    const mockOrder = {
      id: "order-1",
      createdByUserId: "customer-creator",
      fulfillmentStatus: FulfillmentStatus.READY,
    };

    it("should allow the order creator to mark order as DELIVERED", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "customer-creator", role: "BARISTA" });
      orderRepositoryMock.updateFulfillmentStatus.mockResolvedValue({} as any);

      await orderService.deliverOrder("order-1", "customer-creator");

      expect(orderRepositoryMock.updateFulfillmentStatus).toHaveBeenCalledWith("order-1", FulfillmentStatus.DELIVERED);
    });

    it("should allow a manager (OWNER/SERVICE_STAFF) to mark order as DELIVERED", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "manager-1", role: "SERVICE_STAFF" });
      orderRepositoryMock.updateFulfillmentStatus.mockResolvedValue({} as any);

      await orderService.deliverOrder("order-1", "manager-1");

      expect(orderRepositoryMock.updateFulfillmentStatus).toHaveBeenCalledWith("order-1", FulfillmentStatus.DELIVERED);
    });

    it("should block a non-creator, non-manager from marking order as DELIVERED", async () => {
      orderRepositoryMock.findById.mockResolvedValue(mockOrder as any);
      prismaInstance.user.findUnique.mockResolvedValue({ id: "other-user", role: "BARISTA" });

      await expect(orderService.deliverOrder("order-1", "other-user")).rejects.toThrow(
        "Only the creator of the order or a manager can mark it as DELIVERED"
      );
    });
  });
});

export const ownershipTestSuiteName = "Order Ownership Tests";
