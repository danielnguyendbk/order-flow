import { AuditEntityType, PaymentMethod, PaymentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface RevenueReportInput {
  from: Date;
  to: Date;
}

export class RevenueReportService {
  constructor(private readonly db: PrismaClient = prisma) {}

  public async getRevenueReport(input: RevenueReportInput) {
    const [paidOrders, refundLogs] = await Promise.all([
      this.db.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: {
            gte: input.from,
            lte: input.to,
          },
        },
        include: { payment: true },
        orderBy: { paidAt: "asc" },
      }),
      this.db.auditLog.findMany({
        where: {
          action: "MANUAL_REFUND_RECORDED",
          entityType: AuditEntityType.PAYMENT,
          createdAt: {
            gte: input.from,
            lte: input.to,
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const cash = { amount: BigInt(0), count: 0 };
    const qr = { amount: BigInt(0), count: 0 };

    for (const order of paidOrders) {
      const receivedAmount = order.payment?.receivedAmount ?? order.totalAmount;

      if (order.paymentMethod === PaymentMethod.CASH) {
        cash.amount += receivedAmount;
        cash.count += 1;
      }

      if (order.paymentMethod === PaymentMethod.QR) {
        qr.amount += receivedAmount;
        qr.count += 1;
      }
    }

    const refunded = refundLogs.reduce(
      (acc, log) => {
        const details = log.details as Record<string, unknown>;
        const amount = parseBigInt(details.refundAmount);
        return {
          amount: acc.amount + amount,
          count: acc.count + 1,
        };
      },
      { amount: BigInt(0), count: 0 }
    );

    const grossRevenue = cash.amount + qr.amount;
    const netRevenue = grossRevenue - refunded.amount;

    return {
      range: {
        from: input.from.toISOString(),
        to: input.to.toISOString(),
      },
      summary: {
        grossRevenue,
        refundedAmount: refunded.amount,
        netRevenue,
        paidOrderCount: paidOrders.length,
        refundCount: refunded.count,
      },
      byMethod: {
        CASH: cash,
        QR: qr,
        REFUNDED: refunded,
      },
    };
  }
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return BigInt(0);
}
