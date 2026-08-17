import { describe, expect, it, vi } from "vitest";

import { RefundService } from "../refund.service";

const tx = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  AuditEntityType: {
    PAYMENT: "PAYMENT",
  },
  PrismaClient: vi.fn(() => ({
    $transaction: vi.fn((callback) => callback(tx)),
  })),
}));

describe("RefundService", () => {
  it("records a financial audit log for an owner refund", async () => {
    vi.clearAllMocks();
    tx.order.findUnique
      .mockResolvedValueOnce({
        id: "order-1",
        orderCode: "ORD-REFUND-1",
        paymentStatus: "PAID",
        paymentMethod: "QR",
        payment: {
          id: "payment-1",
          receivedAmount: 70000n,
        },
      })
      .mockResolvedValueOnce({
        id: "order-1",
        payment: { id: "payment-1" },
        items: [],
      });
    tx.user.findUnique.mockResolvedValue({ id: "owner-1", role: "OWNER" });
    tx.auditLog.findFirst.mockResolvedValue(null);
    tx.auditLog.create.mockResolvedValue({ id: 1n });

    const result = await new RefundService().refundOrder("order-1", {
      actorUserId: "owner-1",
      reason: " Customer requested refund ",
      amount: 50000,
    });

    expect(result.refund).toEqual({
      amount: 50000n,
      reason: "Customer requested refund",
      refundedByUserId: "owner-1",
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "owner-1",
        action: "MANUAL_REFUND_RECORDED",
        entityType: "PAYMENT",
        entityId: "payment-1",
        details: expect.objectContaining({
          orderCode: "ORD-REFUND-1",
          refundAmount: "50000",
          receivedAmount: "70000",
          reason: "Customer requested refund",
        }),
      }),
    });
  });

  it("rejects duplicate refunds for the same payment", async () => {
    vi.clearAllMocks();
    tx.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderCode: "ORD-REFUND-1",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      payment: {
        id: "payment-1",
        receivedAmount: 70000n,
      },
    });
    tx.user.findUnique.mockResolvedValue({ id: "owner-1", role: "OWNER" });
    tx.auditLog.findFirst.mockResolvedValue({ id: 1n });

    await expect(
      new RefundService().refundOrder("order-1", {
        actorUserId: "owner-1",
        reason: "Already refunded",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
