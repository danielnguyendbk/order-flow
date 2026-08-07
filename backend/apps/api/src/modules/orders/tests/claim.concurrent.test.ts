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
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
  };
});

import { PrismaClient } from "@prisma/client";

describe("Order claim concurrency", () => {
  let prismaInstance: any;
  let service: OrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaInstance = new PrismaClient();
    service = new OrderService(
      {} as OrderRepository,
      { create: jest.fn().mockResolvedValue({} as any) } as any,
      {} as PaymentRepository,
    );
  });

  it("allows only one barista to win concurrent claim attempts", async () => {
    let claimed = false;

    prismaInstance.order.update.mockImplementation(async () => {
      if (claimed) throw new Error("Record not found");
      claimed = true;
      return {
        id: "order-1",
        orderCode: "ORD-1",
        createdByUserId: "customer-1",
        assignedBaristaId: "barista-1",
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.PREPARING,
        totalAmount: 50000n,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const results = await Promise.allSettled([
      service.claimOrder("order-1", "barista-1"),
      service.claimOrder("order-1", "barista-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
