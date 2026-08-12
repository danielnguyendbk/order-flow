import { AuditEntityType, PaymentMethod, PaymentStatus, PrismaClient } from "@prisma/client";
import { prisma } from "../../db";

export interface RevenueReportInput {
  from: Date;
  to: Date;
  groupBy?: "hour" | "day" | "week" | "month";
}

export interface TimeRevenueItem {
  time: string;
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

    const groupBy = input.groupBy || "day";
    const timeMap = new Map<string, TimeRevenueItem>();

    const startMs = input.from.getTime();
    const endMs = input.to.getTime();

    // Iterate hour by hour to ensure no missing buckets due to daylight saving/timezone shifts
    for (let ms = startMs; ms <= endMs; ms += 3600000) {
      const bucketStr = getLocalTimeBucket(new Date(ms), groupBy);
      if (!timeMap.has(bucketStr)) {
        timeMap.set(bucketStr, {
          time: bucketStr,
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
      const bucketStr = getLocalTimeBucket(orderDate, groupBy);
      const item = timeMap.get(bucketStr);

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
      const bucketStr = getLocalTimeBucket(log.createdAt, groupBy);
      const item = timeMap.get(bucketStr);

      refunded.amount += amount;
      refunded.count += 1;

      if (item) {
        item.refundedAmount += amount;
        item.refundCount += 1;
      }
    }

    const byTime = Array.from(timeMap.values()).map((item) => {
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
    const totalBuckets = byTime.length;
    const avgDailyNetRevenue = totalBuckets > 0 ? netRevenue / BigInt(totalBuckets) : BigInt(0);

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
        totalDays: totalBuckets,
        avgDailyNetRevenue,
      },
      byMethod: {
        CASH: cash,
        QR: qr,
        REFUNDED: refunded,
      },
      byTime,
    };
  }
}

const hcmFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false
});

function getLocalTimeBucket(date: Date, groupBy: string): string {
  const parts = hcmFormatter.formatToParts(date);
  const map = {} as Record<string, string>;
  for (const p of parts) map[p.type] = p.value;
  
  if (groupBy === "hour") return `${map.year}-${map.month}-${map.day} ${map.hour}:00`;
  if (groupBy === "month") return `${map.year}-${map.month}`;
  if (groupBy === "week") {
    // get monday of this week in local time
    const d = new Date(`${map.year}-${map.month}-${map.day}T12:00:00Z`);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return d.toISOString().substring(0, 10);
  }
  return `${map.year}-${map.month}-${map.day}`;
}

const hcmDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

function toLocalDateString(date: Date): string {
  return hcmDateFormatter.format(date);
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return BigInt(0);
}

