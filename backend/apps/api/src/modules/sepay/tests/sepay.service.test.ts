import { TransactionMatchStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      findUnique: vi.fn().mockResolvedValue(candidate ? {
        id: candidate.orderId,
        orderCode: candidate.order.orderCode,
        totalAmount: candidate.expectedAmount,
        paymentMethod: candidate.order.paymentMethod,
        createdByUserId: "staff-1",
        creator: { telegramChatId: 100n, telegramUserId: 99n },
        items: [{ itemName: "Trà đào", quantity: 2, note: null }],
      } : null),
    },
    orderStatusHistory: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: vi.fn().mockImplementation(async ({ where }) => where.role === "BARISTA"
        ? [{ id: "barista-1", telegramChatId: 123n, telegramUserId: null }]
        : [{ id: "owner-1", telegramChatId: 200n, telegramUserId: 201n }]),
    },
    notification: {
      upsert: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
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
  afterEach(() => vi.unstubAllEnvs());

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
    expect(tx.sepayTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rawPayload: { source: "sepay-webhook", schemaVersion: 1 } }),
    }));
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        paidAt: expect.any(Date),
      },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ recipientUserId: "barista-1", event: "ORDER_PAID" })],
      skipDuplicates: true,
    }));
    expect(tx.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ event: "ORDER_PAID", recipientUserId: "staff-1" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SEPAY_WEBHOOK_MATCHED" }),
    }));
  });

  it("accepts the official SePay Apikey authorization header", async () => {
    vi.stubEnv("SEPAY_WEBHOOK_API_KEY", "live-webhook-key");
    const tx = buildTx(null);

    await expect(buildService(tx).handleWebhook({
      id: 92704,
      gateway: "Vietcombank",
      transactionDate: "2026-08-10 21:00:00",
      accountNumber: "1017588888",
      code: "UNKNOWN",
      content: "UNKNOWN chuyen tien",
      transferType: "in",
      transferAmount: 10_000,
      referenceCode: "FT24012345678",
    }, { authorization: "Apikey live-webhook-key" })).resolves.toMatchObject({
      duplicate: false,
      matched: false,
      matchStatus: TransactionMatchStatus.WRONG_CODE,
    });
  });

  it("rejects an invalid API key and fails closed in production when no key is configured", async () => {
    vi.stubEnv("SEPAY_WEBHOOK_API_KEY", "live-webhook-key");
    await expect(buildService(buildTx(null)).handleWebhook(
      { id: 92705, transferAmount: 10_000, content: "UNKNOWN" },
      { authorization: "Apikey wrong-key" },
    )).rejects.toMatchObject({ statusCode: 401 });

    vi.stubEnv("SEPAY_WEBHOOK_API_KEY", "");
    vi.stubEnv("SEPAY_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(buildService(buildTx(null)).handleWebhook(
      { id: 92706, transferAmount: 10_000, content: "UNKNOWN" },
      {},
    )).rejects.toMatchObject({ statusCode: 503 });
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
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ event: "PAYMENT_REVIEW", recipientUserId: "owner-1" })],
      skipDuplicates: true,
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SEPAY_WEBHOOK_REVIEW_REQUIRED" }),
    }));
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

  it("moves cancelled-order payments to review and notifies owners", async () => {
    const tx = buildTx(buildCandidate(undefined, {
      order: { fulfillmentStatus: FulfillmentStatus.CANCELLED },
    }));
    const result = await buildService(tx).handleWebhook(
      { id: "99007006", amount: "100000", content: "PAY-TEST-001" },
      {}
    );

    expect(result.matchStatus).toBe(TransactionMatchStatus.UNMATCHED);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { paymentStatus: PaymentStatus.REVIEW },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ event: "PAYMENT_REVIEW", orderId: "order-1" })],
      skipDuplicates: true,
    }));
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
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ event: "PAYMENT_REVIEW", orderId: undefined })],
      skipDuplicates: true,
    }));
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
    expect(tx.notification.upsert).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
