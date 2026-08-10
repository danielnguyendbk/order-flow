import { PrismaClient } from "@prisma/client";
import { Payment } from "../orders/order.types";
import { generatePaymentCode } from "../orders/order-code";

const prisma = new PrismaClient();

/**
 * Repository for all `payments` database operations.
 */
export class PaymentRepository {
  /**
   * Creates a new payment record linked to the given order.
   * Generates a `paymentCode` used for SePay QR matching.
   *
   * @param orderId        - The parent order ID.
   * @param orderCode      - The order code used to derive payment code.
   * @param expectedAmount - The total amount that must be paid.
   * @returns The created Payment.
   */
  public async createForOrder(
    orderId:        string,
    orderCode:      string,
    expectedAmount: bigint
  ): Promise<Payment> {
    const paymentCode = generatePaymentCode(orderCode);

    const payment = await prisma.payment.create({
      data: {
        orderId,
        paymentCode,
        expectedAmount,
      },
    });

    return payment as unknown as Payment;
  }

  /**
   * Returns the payment record for a given order.
   *
   * @param orderId - The order ID.
   * @returns The Payment or null.
   */
  public async findByOrderId(orderId: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
    });
    return payment as unknown as Payment | null;
  }

  /**
   * Returns every payment record linked to an order.
   *
   * The current schema allows one payment per order, but this returns an array
   * so the HTTP contract can stay stable if QR/refund records expand later.
   */
  public async findManyByOrderId(orderId: string): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return payments as unknown as Payment[];
  }

  /**
   * Marks a payment as confirmed via cash by a staff member.
   *
   * @param paymentId           - The payment ID.
   * @param confirmedByUserId   - The staff user who confirmed the cash.
   * @param receivedAmount      - The actual amount received.
   * @returns Updated Payment.
   */
  public async confirmCash(
    paymentId:          string,
    confirmedByUserId:  string,
    receivedAmount:     bigint
  ): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        receivedAmount,
        cashConfirmedByUserId: confirmedByUserId,
        confirmedAt:           new Date(),
      },
    });
    return payment as unknown as Payment;
  }
}
