import { AuditEntityType, PaymentMethod, PaymentStatus, PrismaClient } from "@prisma/client";
import { prisma } from "../../db";

export interface RevenueReportInput {
  from: Date;
  to: Date;
}

export interface DailyRevenueItem {
  date: string;
  cashAmount: bigint;
  qrAmount: bigint;
  grossRevenue: bigint;
  refundedAmount: bigint;
  netRevenue: bigint;
  orderCount: number;
  refundCount: number;
}

export class RevenueReportService {
  constructor(private readonly db: PrismaClient = prisma) {}

  public async getRevenueReport(input: RevenueReportInput) {
    const [paidOrders, refundLogs] = await Promise.all([
      this.db.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          OR: [
            { paidAt: { gte: input.from, lte: input.to } },
            { paidAt: null, createdAt: { gte: input.from, lte: input.to } },
          ],
        },
        include: { payment: true },
        orderBy: { createdAt: "asc" },
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

    const startDateStr = toLocalDateString(input.from);
    const endDateStr = toLocalDateString(input.to);

    const dailyMap = new Map<string, DailyRevenueItem>();

    const startMs = new Date(`${startDateStr}T00:00:00+07:00`).getTime();
    const endMs = new Date(`${endDateStr}T00:00:00+07:00`).getTime();

    for (let ms = startMs; ms <= endMs + 3600000; ms += 86400000) {
      const dStr = toLocalDateString(new Date(ms));
      if (!dailyMap.has(dStr)) {
        dailyMap.set(dStr, {
          date: dStr,
          cashAmount: BigInt(0),
          qrAmount: BigInt(0),
          grossRevenue: BigInt(0),
          refundedAmount: BigInt(0),
          netRevenue: BigInt(0),
          orderCount: 0,
          refundCount: 0,
        });
      }
    }

    const cash = { amount: BigInt(0), count: 0 };
    const qr = { amount: BigInt(0), count: 0 };

    for (const order of paidOrders) {
      const receivedAmount = order.payment?.receivedAmount ?? order.totalAmount;
      const orderDate = order.paidAt ?? order.createdAt;
      const dStr = toLocalDateString(orderDate);
      const item = dailyMap.get(dStr);

      if (order.paymentMethod === PaymentMethod.CASH) {
        cash.amount += receivedAmount;
        cash.count += 1;
        if (item) {
          item.cashAmount += receivedAmount;
          item.orderCount += 1;
        }
      }

      if (order.paymentMethod === PaymentMethod.QR) {
        qr.amount += receivedAmount;
        qr.count += 1;
        if (item) {
          item.qrAmount += receivedAmount;
          item.orderCount += 1;
        }
      }
    }

    const refunded = { amount: BigInt(0), count: 0 };

    for (const log of refundLogs) {
      const details = log.details as Record<string, unknown>;
      const amount = parseBigInt(details.refundAmount);
      const dStr = toLocalDateString(log.createdAt);
      const item = dailyMap.get(dStr);

      refunded.amount += amount;
      refunded.count += 1;

      if (item) {
        item.refundedAmount += amount;
        item.refundCount += 1;
      }
    }

    const byDate = Array.from(dailyMap.values()).map((item) => {
      const grossRevenue = item.cashAmount + item.qrAmount;
      const netRevenue = grossRevenue - item.refundedAmount;
      return {
        ...item,
        grossRevenue,
        netRevenue,
      };
    });

    const grossRevenue = cash.amount + qr.amount;
    const netRevenue = grossRevenue - refunded.amount;
    const totalDays = byDate.length;
    const avgDailyNetRevenue = totalDays > 0 ? netRevenue / BigInt(totalDays) : BigInt(0);

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
        totalDays,
        avgDailyNetRevenue,
      },
      byMethod: {
        CASH: cash,
        QR: qr,
        REFUNDED: refunded,
      },
      byDate,
    };
  }
}

function toLocalDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return BigInt(0);
}

