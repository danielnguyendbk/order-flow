import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { QrPaymentPoller, qrPaymentPollerConfig } from "./qr-payment-poller";
import { SepayApiClientError } from "../modules/sepay/sepay-api.client";

const pendingPayment = {
  paymentCode: "PAY2608171893",
  expectedAmount: 5_000n,
  createdAt: new Date("2026-08-17T06:46:21.008Z"),
};

describe("QrPaymentPoller", () => {
  it("uses a three-second interval by default and never permits a faster interval", () => {
    expect(qrPaymentPollerConfig({}).intervalMs).toBe(3_000);
    expect(qrPaymentPollerConfig({ SEPAY_QR_POLL_INTERVAL_MS: "100" }).intervalMs).toBe(3_000);
    expect(qrPaymentPollerConfig({ SEPAY_QR_POLL_INTERVAL_MS: "5000" }).intervalMs).toBe(5_000);
  });

  it("sends every pending QR candidate through the existing idempotent SePay pipeline", async () => {
    const database = {
      payment: { findMany: vi.fn().mockResolvedValue([pendingPayment]) },
    } as unknown as Pick<PrismaClient, "payment">;
    const transaction = { id: "sepay-1", content: pendingPayment.paymentCode, transferAmount: "5000" };
    const lookup = { findIncomingTransaction: vi.fn().mockResolvedValue(transaction) };
    const transactionProcessor = { handleTrustedTransaction: vi.fn().mockResolvedValue({ matched: true }) };
    const poller = new QrPaymentPoller(
      database,
      lookup,
      transactionProcessor,
      { enabled: true, accountNumber: "0337990731", intervalMs: 3_000, batchSize: 5 },
    );

    await poller.poll();

    expect(database.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: "desc" },
      take: 5,
    }));
    expect(lookup.findIncomingTransaction).toHaveBeenCalledWith({
      accountNumber: "0337990731",
      amount: 5_000n,
      paymentCode: pendingPayment.paymentCode,
      createdAt: pendingPayment.createdAt,
    });
    expect(transactionProcessor.handleTrustedTransaction).toHaveBeenCalledWith(transaction);
  });

  it("does not alter a pending order when SePay has no exact transaction", async () => {
    const database = {
      payment: { findMany: vi.fn().mockResolvedValue([pendingPayment]) },
    } as unknown as Pick<PrismaClient, "payment">;
    const lookup = { findIncomingTransaction: vi.fn().mockResolvedValue(null) };
    const transactionProcessor = { handleTrustedTransaction: vi.fn() };
    const poller = new QrPaymentPoller(
      database,
      lookup,
      transactionProcessor,
      { enabled: true, accountNumber: "0337990731", intervalMs: 3_000, batchSize: 5 },
    );

    await poller.poll();

    expect(transactionProcessor.handleTrustedTransaction).not.toHaveBeenCalled();
  });

  it("backs off instead of repeatedly calling SePay after a rate limit", async () => {
    const database = {
      payment: { findMany: vi.fn().mockResolvedValue([pendingPayment]) },
    } as unknown as Pick<PrismaClient, "payment">;
    const lookup = {
      findIncomingTransaction: vi.fn().mockRejectedValue(new SepayApiClientError(
        429,
        "SEPAY_API_RATE_LIMITED",
        "Rate limited",
        60_000,
      )),
    };
    const poller = new QrPaymentPoller(
      database,
      lookup,
      { handleTrustedTransaction: vi.fn() },
      { enabled: true, accountNumber: "0337990731", intervalMs: 3_000, batchSize: 5 },
    );

    await poller.poll();
    await poller.poll();

    expect(lookup.findIncomingTransaction).toHaveBeenCalledTimes(1);
  });
});
