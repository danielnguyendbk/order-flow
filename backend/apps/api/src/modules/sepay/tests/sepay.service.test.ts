import { TransactionMatchStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { FulfillmentStatus, PaymentMethod, PaymentStatus } from "../../orders/order.types";
import { SepayService } from "../sepay.service";

function buildCandidate(amount = BigInt(100000), overrides: any = {}) {
  return {
    id: "payment-1",
    orderId: "order-1",
    paymentCode: "PAY-TEST-001",
    expectedAmount: amount,
    order: {
      id: "order-1",
      orderCode: "ORDER-001",
      paymentMethod: PaymentMethod.QR,
      paymentStatus: PaymentStatus.PENDING,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      ...overrides.order,
    },
    ...overrides.payment,
  };
}

function buildTx(candidate: any | null, existingTransaction: any | null = null) {
  return {
    sepayTransaction: {
      findUnique: vi.fn().mockResolvedValue(existingTransaction),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: "transaction-1",
        paymentId: data.paymentId,
        matchStatus: data.matchStatus,
      })),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(candidate),
      findMany: vi.fn().mockResolvedValue(candidate ? [candidate] : []),
      update: vi.fn().mockResolvedValue({}),
    },
    order: {
      update: vi.fn().mockResolvedValue({}),
    },
    orderStatusHistory: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function buildService(tx: any) {
  const db = {
    $transaction: vi.fn((callback) => callback(tx)),
  };

  return new SepayService(db as any);
}

describe("SepayService", () => {
  it("marks exact QR payments as PAID and QUEUED", async () => {
    const tx = buildTx(buildCandidate());
    const result = await buildService(tx).handleWebhook(
      {
        id: "99007001",
        amount: "100000",
        content: "Transfer PAY-TEST-001",
      },
      {}
    );

    expect(result).toMatchObject({
      duplicate: false,
      matched: true,
      paymentId: "payment-1",
      matchStatus: TransactionMatchStatus.MATCHED,
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        paidAt: expect.any(Date),
      },
    });
  });

  it("classifies underpaid webhook without queueing the order", async () => {
    const tx = buildTx(buildCandidate());
    const result = await buildService(tx).handleWebhook(
      { id: "99007002", amount: "90000", content: "PAY-TEST-001" },
      {}
    );

    expect(result.matchStatus).toBe(TransactionMatchStatus.UNMATCHED);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { paymentStatus: PaymentStatus.UNDERPAID },
    });
  });

  it("classifies overpaid webhook without queueing the order", async () => {
    const tx = buildTx(buildCandidate());
    const result = await buildService(tx).handleWebhook(
      { id: "99007003", amount: "120000", content: "PAY-TEST-001" },
      {}
    );

    expect(result.matchStatus).toBe(TransactionMatchStatus.UNMATCHED);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { paymentStatus: PaymentStatus.OVERPAID },
    });
  });

  it("stores wrong-code webhook without linking payment", async () => {
    const tx = buildTx(null);
    const result = await buildService(tx).handleWebhook(
      { id: "99007004", amount: "100000", content: "PAY-WRONG-001" },
      {}
    );

    expect(result).toMatchObject({
      duplicate: false,
      matched: false,
      paymentId: null,
      matchStatus: TransactionMatchStatus.WRONG_CODE,
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("returns success for duplicate webhook without processing twice", async () => {
    const existingTransaction = {
      id: "transaction-existing",
      paymentId: "payment-1",
      matchStatus: TransactionMatchStatus.MATCHED,
    };
    const tx = buildTx(buildCandidate(), existingTransaction);

    const result = await buildService(tx).handleWebhook(
      { id: "99007005", amount: "100000", content: "PAY-TEST-001" },
      {}
    );

    expect(result).toEqual({
      duplicate: true,
      matched: true,
      transactionId: "transaction-existing",
      paymentId: "payment-1",
      matchStatus: TransactionMatchStatus.MATCHED,
    });
    expect(tx.sepayTransaction.create).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});
