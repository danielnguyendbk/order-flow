import { OrderRepository } from "../order.repository";
import { FulfillmentStatus, OrderStatusDomain, PaymentStatus } from "../order.types";
import { generateOrderCode } from "../order-code";

jest.mock("@prisma/client", () => {
  const mPrisma = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
    Prisma: {},
  };
});

jest.mock("../order-code", () => ({
  generateOrderCode: jest.fn(),
}));

import { PrismaClient } from "@prisma/client";

describe("OrderRepository", () => {
  let prismaInstance: any;
  let repository: OrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaInstance = new PrismaClient();
    repository = new OrderRepository();
  });

  it("retries order code generation when the generated code collides", async () => {
    (generateOrderCode as jest.Mock)
      .mockReturnValueOnce("ORD-20260806-1000")
      .mockReturnValueOnce("ORD-20260806-1001");

    const createdOrder = {
      id: "order-1",
      orderCode: "ORD-20260806-1001",
      createdByUserId: "user-1",
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      totalAmount: 20000n,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaInstance.order.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce(createdOrder);

    const order = await repository.create("user-1", undefined, undefined, [
      { menuItemId: "item-1", itemName: "Coffee", unitPrice: 20000n, quantity: 1 },
    ]);

    expect(order.orderCode).toBe("ORD-20260806-1001");
    expect(prismaInstance.order.create).toHaveBeenCalledTimes(2);
    expect(prismaInstance.order.create.mock.calls[1][0].data.orderCode).toBe("ORD-20260806-1001");
  });

  it("returns order detail with timeline entries", async () => {
    const createdAt = new Date("2026-08-06T00:00:00.000Z");
    prismaInstance.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderCode: "ORD-20260806-1000",
      createdByUserId: "user-1",
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      totalAmount: 20000n,
      items: [],
      history: [
        {
          id: "history-1",
          orderId: "order-1",
          statusDomain: OrderStatusDomain.FULFILLMENT,
          oldStatus: null,
          newStatus: FulfillmentStatus.PENDING_PAYMENT,
          changedByUserId: "user-1",
          reason: null,
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    });

    const order = await repository.findById("order-1");

    expect(prismaInstance.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: { items: true, history: { orderBy: { createdAt: "asc" } } },
    });
    expect(order?.timeline).toEqual([
      expect.objectContaining({ id: "history-1", newStatus: FulfillmentStatus.PENDING_PAYMENT }),
    ]);
    expect((order as any).history).toBeUndefined();
  });
});
