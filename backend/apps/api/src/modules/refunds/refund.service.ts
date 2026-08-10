import createHttpError from "http-errors";
import { AuditEntityType, Prisma, PrismaClient } from "@prisma/client";
import { PaymentStatus } from "../orders/order.types";

const prisma = new PrismaClient();

export interface RefundOrderInput {
  refundedByUserId: string;
  reason: string;
  amount?: number;
}

export class RefundService {
  public async refundOrder(orderId: string, input: RefundOrderInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [order, actor] = await Promise.all([
        tx.order.findUnique({
          where: { id: orderId },
          include: { payment: true },
        }),
        tx.user.findUnique({ where: { id: input.refundedByUserId } }),
      ]);

      if (!order) throw createHttpError(404, `Order ${orderId} not found`);
      if (!actor) throw createHttpError(404, `User ${input.refundedByUserId} not found`);
      if (actor.role !== "OWNER") {
        throw createHttpError(403, "Only owner can record a manual refund");
      }
      if (!order.payment) {
        throw createHttpError(409, `Payment record for order ${orderId} has not been created`);
      }
      if (![PaymentStatus.PAID, PaymentStatus.OVERPAID].includes(order.paymentStatus as any)) {
        throw createHttpError(
          409,
          `Order payment status must be PAID or OVERPAID. Current: ${order.paymentStatus}`
        );
      }
      if (order.payment.receivedAmount <= BigInt(0)) {
        throw createHttpError(409, "Cannot refund an order without received payment amount");
      }

      const refundAmount = input.amount === undefined
        ? order.payment.receivedAmount
        : BigInt(input.amount);

      if (refundAmount > order.payment.receivedAmount) {
        throw createHttpError(400, "Refund amount cannot exceed received payment amount");
      }

      const existingRefund = await tx.auditLog.findFirst({
        where: {
          action: "MANUAL_REFUND_RECORDED",
          entityType: AuditEntityType.PAYMENT,
          entityId: order.payment.id,
        },
      });

      if (existingRefund) {
        throw createHttpError(409, "Manual refund has already been recorded for this payment");
      }

      const auditLog = await tx.auditLog.create({
        data: {
          actorUserId: input.refundedByUserId,
          action: "MANUAL_REFUND_RECORDED",
          entityType: AuditEntityType.PAYMENT,
          entityId: order.payment.id,
          details: {
            orderId,
            orderCode: order.orderCode,
            paymentId: order.payment.id,
            refundAmount: refundAmount.toString(),
            receivedAmount: order.payment.receivedAmount.toString(),
            paymentMethod: order.paymentMethod,
            previousPaymentStatus: order.paymentStatus,
            reason: input.reason.trim(),
          },
        },
      });

      return {
        order: await tx.order.findUnique({
          where: { id: orderId },
          include: { payment: true, items: true },
        }),
        auditLog,
        refund: {
          amount: refundAmount,
          reason: input.reason.trim(),
          refundedByUserId: input.refundedByUserId,
        },
      };
    });
  }
}
