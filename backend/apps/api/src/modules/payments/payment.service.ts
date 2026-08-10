import createHttpError from "http-errors";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  FulfillmentStatus,
  OrderStatusDomain,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../orders/order.types";
import { PaymentRepository } from "./payment.repository";
import { generatePaymentCode } from "../orders/order-code";

const prisma = new PrismaClient();

export interface ConfirmCashInput {
  confirmedByUserId: string;
  amount?: number;
}

export interface InitQrPaymentInput {
  requestedByUserId: string;
}

export interface InitQrPaymentResult {
  payment: Payment;
  transferContent: string;
  amount: bigint;
}

export class PaymentService {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  public async listOrderPayments(orderId: string): Promise<Payment[]> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    return this.paymentRepository.findManyByOrderId(orderId);
  }

  public async confirmCash(orderId: string, input: ConfirmCashInput): Promise<Payment> {
    const confirmedByUserId = input.confirmedByUserId;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [order, actor] = await Promise.all([
        tx.order.findUnique({
          where: { id: orderId },
          include: { payment: true },
        }),
        tx.user.findUnique({ where: { id: confirmedByUserId } }),
      ]);

      if (!order) throw createHttpError(404, `Order ${orderId} not found`);
      if (!actor) throw createHttpError(404, `User ${confirmedByUserId} not found`);
      if (!order.payment) {
        throw createHttpError(409, `Payment record for order ${orderId} has not been created`);
      }

      const isCreator = order.createdByUserId === confirmedByUserId;
      const isManager = actor.role === "OWNER";
      if (!isCreator && !isManager) {
        throw createHttpError(403, "Only the order creator or owner can confirm cash payment");
      }

      if (order.paymentStatus !== PaymentStatus.UNPAID) {
        throw createHttpError(409, `Order payment status must be UNPAID. Current: ${order.paymentStatus}`);
      }

      if (order.fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
        throw createHttpError(
          409,
          `Order fulfillment status must be PENDING_PAYMENT. Current: ${order.fulfillmentStatus}`
        );
      }

      if (order.payment.confirmedAt || order.payment.receivedAmount > BigInt(0)) {
        throw createHttpError(409, "Cash payment already confirmed");
      }

      const receivedAmount =
        input.amount === undefined ? order.totalAmount : BigInt(input.amount);

      if (receivedAmount !== order.totalAmount) {
        throw createHttpError(400, "Cash amount must match the order total amount");
      }

      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: order.payment.id,
          confirmedAt: null,
          receivedAmount: BigInt(0),
        },
        data: {
          receivedAmount,
          cashConfirmedByUserId: confirmedByUserId,
          confirmedAt: new Date(),
        },
      });

      if (paymentUpdate.count !== 1) {
        throw createHttpError(409, "Cash payment already confirmed");
      }

      const orderUpdate = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: PaymentStatus.UNPAID as any,
          fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT as any,
        },
        data: {
          paymentMethod: "CASH" as any,
          paymentStatus: PaymentStatus.PAID as any,
          fulfillmentStatus: FulfillmentStatus.QUEUED as any,
          paidAt: new Date(),
        },
      });

      if (orderUpdate.count !== 1) {
        throw createHttpError(409, "Order is no longer eligible for cash confirmation");
      }

      await tx.orderStatusHistory.createMany({
        data: [
          {
            orderId,
            statusDomain: OrderStatusDomain.PAYMENT as any,
            oldStatus: PaymentStatus.UNPAID,
            newStatus: PaymentStatus.PAID,
            changedByUserId: confirmedByUserId,
            reason: "Cash payment confirmed",
          },
          {
            orderId,
            statusDomain: OrderStatusDomain.FULFILLMENT as any,
            oldStatus: FulfillmentStatus.PENDING_PAYMENT,
            newStatus: FulfillmentStatus.QUEUED,
            changedByUserId: confirmedByUserId,
            reason: "Cash payment confirmed",
          },
        ],
      });

      const payment = await tx.payment.findUnique({
        where: { id: order.payment.id },
      });

      return payment as unknown as Payment;
    });
  }

  public async initQrPayment(
    orderId: string,
    input: InitQrPaymentInput
  ): Promise<InitQrPaymentResult> {
    const requestedByUserId = input.requestedByUserId;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [order, actor] = await Promise.all([
        tx.order.findUnique({
          where: { id: orderId },
          include: { payment: true },
        }),
        tx.user.findUnique({ where: { id: requestedByUserId } }),
      ]);

      if (!order) throw createHttpError(404, `Order ${orderId} not found`);
      if (!actor) throw createHttpError(404, `User ${requestedByUserId} not found`);

      const isCreator = order.createdByUserId === requestedByUserId;
      const isManager = actor.role === "OWNER";
      if (!isCreator && !isManager) {
        throw createHttpError(403, "Only the order creator or owner can initialize QR payment");
      }

      if (order.paymentStatus === PaymentStatus.PENDING && order.paymentMethod === PaymentMethod.QR) {
        if (!order.payment) {
          throw createHttpError(409, `Payment record for order ${orderId} has not been created`);
        }

        return {
          payment: order.payment as unknown as Payment,
          transferContent: this.buildQrTransferContent(order.orderCode, order.payment.paymentCode),
          amount: order.payment.expectedAmount,
        };
      }

      if (order.paymentStatus !== PaymentStatus.UNPAID) {
        throw createHttpError(409, `Order payment status must be UNPAID. Current: ${order.paymentStatus}`);
      }

      if (order.fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
        throw createHttpError(
          409,
          `Order fulfillment status must be PENDING_PAYMENT. Current: ${order.fulfillmentStatus}`
        );
      }

      const paymentCode = order.payment?.paymentCode ?? generatePaymentCode(order.orderCode);

      const payment = order.payment
        ? await tx.payment.update({
            where: { id: order.payment.id },
            data: {
              paymentCode,
              expectedAmount: order.totalAmount,
              receivedAmount: BigInt(0),
              cashConfirmedByUserId: null,
              confirmedAt: null,
            },
          })
        : await tx.payment.create({
            data: {
              orderId,
              paymentCode,
              expectedAmount: order.totalAmount,
              receivedAmount: BigInt(0),
            },
          });

      const orderUpdate = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: PaymentStatus.UNPAID as any,
          fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT as any,
        },
        data: {
          paymentMethod: PaymentMethod.QR as any,
          paymentStatus: PaymentStatus.PENDING as any,
        },
      });

      if (orderUpdate.count !== 1) {
        throw createHttpError(409, "Order is no longer eligible for QR payment initialization");
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusDomain: OrderStatusDomain.PAYMENT as any,
          oldStatus: PaymentStatus.UNPAID,
          newStatus: PaymentStatus.PENDING,
          changedByUserId: requestedByUserId,
          reason: "QR payment initialized",
        },
      });

      return {
        payment: payment as unknown as Payment,
        transferContent: this.buildQrTransferContent(order.orderCode, payment.paymentCode),
        amount: payment.expectedAmount,
      };
    });
  }

  private buildQrTransferContent(orderCode: string, paymentCode?: string | null): string {
    return `${paymentCode ?? generatePaymentCode(orderCode)} ${orderCode}`;
  }
}
