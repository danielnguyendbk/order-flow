import type { PrismaClient } from "@prisma/client";

import { prisma } from "../db";
import {
  SepayApiClient,
  SepayApiClientError,
  type SepayTransactionLookup,
} from "../modules/sepay/sepay-api.client";
import { SepayService } from "../modules/sepay/sepay.service";

export interface QrPaymentPollerConfig {
  enabled: boolean;
  accountNumber: string;
  intervalMs: number;
  batchSize: number;
}

type PaymentStore = Pick<PrismaClient, "payment">;
type TransactionProcessor = Pick<SepayService, "handleTrustedTransaction">;

function boundedPositiveInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function qrPaymentPollerConfig(env: NodeJS.ProcessEnv = process.env): QrPaymentPollerConfig {
  return {
    enabled: env.SEPAY_QR_POLL_ENABLED?.trim().toLowerCase() !== "false",
    accountNumber: env.SEPAY_BANK_ACCOUNT?.trim() ?? "",
    intervalMs: boundedPositiveInteger(env.SEPAY_QR_POLL_INTERVAL_MS, 3_000, 3_000, 60_000),
    batchSize: boundedPositiveInteger(env.SEPAY_QR_POLL_BATCH_SIZE, 5, 1, 25),
  };
}

/**
 * Recovers QR payments when a SePay webhook is delayed or unavailable.
 * Webhooks remain the primary low-latency path; a matched transaction is
 * deliberately passed through SepayService so persistence stays idempotent.
 */
export class QrPaymentPoller {
  private timer: NodeJS.Timeout | undefined;
  private polling = false;
  private lastErrorMessage: string | undefined;
  private retryNotBefore = 0;

  public constructor(
    private readonly database: PaymentStore = prisma,
    private readonly lookup: SepayTransactionLookup = new SepayApiClient(),
    private readonly transactionProcessor: TransactionProcessor = new SepayService(prisma),
    private readonly config: QrPaymentPollerConfig = qrPaymentPollerConfig(),
  ) {}

  public start(): void {
    if (!this.config.enabled) {
      console.info("[qr-payment-poller] disabled by SEPAY_QR_POLL_ENABLED");
      return;
    }
    if (!this.config.accountNumber || !process.env.SEPAY_API_TOKEN?.trim()) {
      console.warn("[qr-payment-poller] not started: SEPAY_BANK_ACCOUNT and SEPAY_API_TOKEN are required");
      return;
    }

    console.info(`[qr-payment-poller] checking pending QR payments every ${this.config.intervalMs}ms`);
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.config.intervalMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  public async poll(): Promise<void> {
    if (this.polling || Date.now() < this.retryNotBefore) return;
    this.polling = true;

    try {
      const payments = await this.database.payment.findMany({
        where: {
          paymentCode: { not: null },
          order: {
            paymentMethod: "QR",
            paymentStatus: "PENDING",
            fulfillmentStatus: "PENDING_PAYMENT",
          },
        },
        select: {
          paymentCode: true,
          expectedAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: this.config.batchSize,
      });

      for (const payment of payments) {
        if (!payment.paymentCode) continue;
        const transaction = await this.lookup.findIncomingTransaction({
          accountNumber: this.config.accountNumber,
          amount: payment.expectedAmount,
          paymentCode: payment.paymentCode,
          createdAt: payment.createdAt,
        });
        if (transaction) await this.transactionProcessor.handleTrustedTransaction(transaction);
      }
      this.lastErrorMessage = undefined;
    } catch (error) {
      if (error instanceof SepayApiClientError && error.code === "SEPAY_API_RATE_LIMITED") {
        const backoffMs = error.retryAfterMs ?? 60_000;
        this.retryNotBefore = Date.now() + backoffMs;
        console.warn(`[qr-payment-poller] SePay rate limited; retrying after ${backoffMs}ms`);
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown QR payment polling error";
      if (message !== this.lastErrorMessage) {
        console.warn(`[qr-payment-poller] ${message}`);
        this.lastErrorMessage = message;
      }
    } finally {
      this.polling = false;
    }
  }
}
