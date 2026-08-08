import { beforeEach, describe, expect, it, vi } from "vitest";

import { FulfillmentStatus, PaymentStatus } from "../../orders/order.types";

vi.mock("@prisma/client", () => {
  const mPrisma = {
    order: {
      findMany: vi.fn(),
    },
  };

  function PrismaClientMock() {
    return mPrisma;
  }

  return {
    PrismaClient: PrismaClientMock,
  };
});

import { PrismaClient } from "@prisma/client";

import { BaristaService } from "../barista.service";

describe("BaristaService", () => {
  let prismaInstance: any;
  let service: BaristaService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaInstance = new PrismaClient();
    service = new BaristaService();
  });

  it("returns only paid queued orders for the queue", async () => {
    prismaInstance.order.findMany.mockResolvedValue([{ id: "order-1" }, { id: "order-2" }]);

    await service.getQueue();

    expect(prismaInstance.order.findMany).toHaveBeenCalledWith({
      where: {
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        paymentStatus: PaymentStatus.PAID,
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns preparing and ready orders for a barista", async () => {
    prismaInstance.order.findMany.mockResolvedValue([]);

    await service.getBaristaOrders("barista-1");

    expect(prismaInstance.order.findMany).toHaveBeenCalledWith({
      where: {
        assignedBaristaId: "barista-1",
        fulfillmentStatus: {
          in: [FulfillmentStatus.PREPARING, FulfillmentStatus.READY],
        },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
  });
});
