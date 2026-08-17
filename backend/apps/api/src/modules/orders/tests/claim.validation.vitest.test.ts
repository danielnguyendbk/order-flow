import { beforeEach, describe, expect, it, vi } from "vitest";

import { FulfillmentStatus, PaymentStatus } from "../order.types";

vi.mock("@prisma/client", () => {
  const prisma = {
    user: { findFirst: vi.fn() },
    order: { update: vi.fn() },
  };

  return {
    PrismaClient: vi.fn().mockImplementation(() => prisma),
  };
});

import { PrismaClient } from "@prisma/client";

import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";
import { OrderRepository } from "../order.repository";
import { OrderService } from "../order.service";

describe("OrderService claim assignment validation", () => {
  let prisma: any;
  let historyRepository: { create: ReturnType<typeof vi.fn> };
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
    historyRepository = { create: vi.fn().mockResolvedValue({}) };
    service = new OrderService(
      {} as OrderRepository,
      historyRepository as unknown as HistoryRepository,
      {} as PaymentRepository,
    );
  });

  it("assigns an order only after finding an active BARISTA", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "barista-1" });
    prisma.order.update.mockResolvedValue({
      id: "order-1",
      assignedBaristaId: "barista-1",
      fulfillmentStatus: FulfillmentStatus.PREPARING,
      items: [],
    });

    await service.claimOrder("order-1", "barista-1");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "barista-1",
        role: "BARISTA",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        assignedBaristaId: null,
        paymentStatus: PaymentStatus.PAID,
      },
      data: {
        fulfillmentStatus: FulfillmentStatus.PREPARING,
        assignedBaristaId: "barista-1",
      },
      include: { items: true },
    });
  });

  it("rejects an owner, inactive Barista, or unknown user before updating the order", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.claimOrder("order-1", "owner-1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Orders can only be assigned to an active BARISTA user.",
    });

    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(historyRepository.create).not.toHaveBeenCalled();
  });
});
