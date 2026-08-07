import createHttpError from "http-errors";
import { Prisma, PrismaClient, TransactionMatchStatus } from "@prisma/client";
import {
  FulfillmentStatus,
  OrderStatusDomain,
  PaymentMethod,
  PaymentStatus,
} from "../orders/order.types";

const prisma = new PrismaClient();

export interface SepayWebhookResult {
  duplicate: boolean;
  matched: boolean;
  transactionId: string;
  paymentId?: string | null;
  matchStatus: TransactionMatchStatus;
}

export class SepayService {
  constructor(private readonly db: PrismaClient = prisma) {}

  public async handleWebhook(payload: any, headers: Record<string, any>): Promise<SepayWebhookResult> {
    this.verifyWebhook(headers);

    const normalized = this.normalizePayload(payload);

    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.sepayTransaction.findUnique({
        where: { sepayTransactionId: normalized.sepayTransactionId },
      });

      if (existing) {
        return {
          duplicate: true,
          matched: existing.matchStatus === TransactionMatchStatus.MATCHED,
          transactionId: existing.id,
          paymentId: existing.paymentId,
          matchStatus: existing.matchStatus,
        };
      }

      const candidate = await this.findPaymentCandidate(tx, normalized);
      const classification = candidate
        ? this.classifyCandidate(candidate, normalized.amountIn)
        : {
            paymentStatus: null,
            fulfillmentStatus: null,
            matchStatus: TransactionMatchStatus.WRONG_CODE,
            differenceAmount: null,
            matched: false,
            reason: "SePay webhook did not contain a known payment code or order code",
          };


      const transaction = await tx.sepayTransaction.create({
        data: {
          sepayTransactionId: normalized.sepayTransactionId,
          paymentId: candidate?.id ?? null,
          transactionDate: normalized.transactionDate,
          code: normalized.code,
          content: normalized.content,
          amountIn: normalized.amountIn,
          referenceCode: normalized.referenceCode,
          matchStatus: classification.matchStatus,
          differenceAmount: classification.differenceAmount,
          rawPayload: normalized.rawPayload,
        },
      });

      if (candidate) {
        await tx.payment.update({
          where: { id: candidate.id },
          data: {
            receivedAmount: normalized.amountIn,
          },
        });

        const orderData: any = {};
        if (classification.paymentStatus) {
          orderData.paymentStatus = classification.paymentStatus as any;
        }
        if (classification.fulfillmentStatus) {
          orderData.fulfillmentStatus = classification.fulfillmentStatus as any;
        }
        if (classification.matched) {
          orderData.paidAt = new Date();
        }

        if (Object.keys(orderData).length > 0) {
          await tx.order.update({
            where: { id: candidate.orderId },
            data: orderData,
          });
        }

        const historyRows = [];
        if (
          classification.paymentStatus &&
          candidate.order.paymentStatus !== classification.paymentStatus
        ) {
          historyRows.push({
            orderId: candidate.orderId,
            statusDomain: OrderStatusDomain.PAYMENT as any,
            oldStatus: candidate.order.paymentStatus,
            newStatus: classification.paymentStatus,
            reason: classification.reason,
          });
        }
        if (
          classification.fulfillmentStatus &&
          candidate.order.fulfillmentStatus !== classification.fulfillmentStatus
        ) {
          historyRows.push({
            orderId: candidate.orderId,
            statusDomain: OrderStatusDomain.FULFILLMENT as any,
            oldStatus: candidate.order.fulfillmentStatus,
            newStatus: classification.fulfillmentStatus,
            reason: classification.reason,
          });
        }

        if (historyRows.length > 0) {
          await tx.orderStatusHistory.createMany({ data: historyRows });
        }
      }

      return {
        duplicate: false,
        matched: classification.matched,
        transactionId: transaction.id,
        paymentId: transaction.paymentId,
        matchStatus: transaction.matchStatus,
      };
    });
  }

  private verifyWebhook(headers: Record<string, any>) {
    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    if (!secret) return;

    const provided =
      headers["x-sepay-webhook-secret"] ??
      headers["x-webhook-secret"] ??
      headers["authorization"];

    const normalized =
      typeof provided === "string" && provided.startsWith("Bearer ")
        ? provided.slice("Bearer ".length)
        : provided;

    if (normalized !== secret) {
      throw createHttpError(401, "Invalid SePay webhook secret");
    }
  }

  private normalizePayload(payload: any) {
    const sepayTransactionId = BigInt(
      payload.sepayTransactionId ??
        payload.sepay_transaction_id ??
        payload.transactionId ??
        payload.transaction_id ??
        payload.id
    );

    const amountIn = BigInt(
      payload.amountIn ?? payload.amount_in ?? payload.transferAmount ?? payload.amount
    );

    const content = String(payload.content ?? payload.description ?? "");
    const code = payload.code ? String(payload.code) : this.extractPaymentCode(content);
    const referenceCode =
      payload.referenceCode ?? payload.reference_code ?? payload.reference ?? null;
    const dateValue =
      payload.transactionDate ?? payload.transaction_date ?? payload.transferDate ?? null;

    return {
      sepayTransactionId,
      amountIn,
      content,
      code,
      referenceCode: referenceCode ? String(referenceCode) : null,
      transactionDate: dateValue ? new Date(dateValue) : new Date(),
      rawPayload: payload,
    };
  }

  private extractPaymentCode(content: string): string | null {
    const match = content.match(/PAY[A-Z0-9-]+/i);
    return match ? match[0].toUpperCase() : null;
  }

  private classifyCandidate(candidate: any, amountIn: bigint) {
    const differenceAmount = amountIn - candidate.expectedAmount;

    if (candidate.order.fulfillmentStatus === FulfillmentStatus.CANCELLED) {
      return {
        paymentStatus: PaymentStatus.REVIEW,
        fulfillmentStatus: null,
        matchStatus: TransactionMatchStatus.UNMATCHED,
        differenceAmount,
        matched: false,
        reason: "SePay transaction arrived after order was cancelled",
      };
    }

    if (amountIn < candidate.expectedAmount) {
      return {
        paymentStatus: PaymentStatus.UNDERPAID,
        fulfillmentStatus: null,
        matchStatus: TransactionMatchStatus.UNMATCHED,
        differenceAmount,
        matched: false,
        reason: "SePay transaction is underpaid",
      };
    }

    if (amountIn > candidate.expectedAmount) {
      return {
        paymentStatus: PaymentStatus.OVERPAID,
        fulfillmentStatus: null,
        matchStatus: TransactionMatchStatus.UNMATCHED,
        differenceAmount,
        matched: false,
        reason: "SePay transaction is overpaid",
      };
    }

    if (
      candidate.order.paymentMethod === PaymentMethod.QR &&
      candidate.order.paymentStatus === PaymentStatus.PENDING &&
      candidate.order.fulfillmentStatus === FulfillmentStatus.PENDING_PAYMENT
    ) {
      return {
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        matchStatus: TransactionMatchStatus.MATCHED,
        differenceAmount,
        matched: true,
        reason: "SePay webhook matched exact payment",
      };
    }

    return {
      paymentStatus: PaymentStatus.REVIEW,
      fulfillmentStatus: null,
      matchStatus: TransactionMatchStatus.UNMATCHED,
      differenceAmount,
      matched: false,
      reason: "SePay transaction needs manual payment review",
    };
  }

  private async findPaymentCandidate(
    tx: Prisma.TransactionClient,
    normalized: ReturnType<SepayService["normalizePayload"]>
  ) {
    const tokens = [normalized.code, normalized.content, normalized.referenceCode]
      .filter(Boolean)
      .map((value) => String(value));

    for (const token of tokens) {
      const byPaymentCode = await tx.payment.findFirst({
        where: {
          paymentCode: {
            not: null,
          },
          OR: [
            { paymentCode: token },
            { paymentCode: { contains: token } },
          ],
        },
        include: { order: true },
      });

      if (byPaymentCode) return byPaymentCode;

      const byContent = await tx.payment.findFirst({
        where: {
          paymentCode: {
            not: null,
          },
          OR: [
            { paymentCode: { contains: token } },
            { order: { orderCode: { contains: token } } },
          ],
        },
        include: { order: true },
      });

      if (byContent) return byContent;
    }

    if (normalized.content) {
      const payments = await tx.payment.findMany({
        where: { paymentCode: { not: null } },
        include: { order: true },
      });

      return payments.find(
        (payment) =>
          (payment.paymentCode && normalized.content.includes(payment.paymentCode)) ||
          normalized.content.includes(payment.order.orderCode)
      );
    }

    return null;
  }
}
