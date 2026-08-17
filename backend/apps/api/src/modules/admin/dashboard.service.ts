import {
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserStatus,
} from "@prisma/client";

import { prisma } from "../../db.js";

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const PAYMENT_ALERT_STATUSES = [
  PaymentStatus.UNDERPAID,
  PaymentStatus.OVERPAID,
  PaymentStatus.REVIEW,
] as const;

export interface DashboardQuery {
  days: number;
  now?: Date;
}

export interface DashboardServicePort {
  getDashboard(query: DashboardQuery): Promise<unknown>;
}

export class DashboardService implements DashboardServicePort {
  constructor(private readonly db: PrismaClient = prisma) {}

  public async getDashboard({ days, now = new Date() }: DashboardQuery) {
    const from = startOfVietnamDay(now, days - 1);
    const todayFrom = startOfVietnamDay(now, 0);

    const [
      totalOrderCount,
      rangeOrderCount,
      paidOrders,
      activeUserCount,
      availableMenuItemCount,
      paymentStatusGroups,
      fulfillmentStatusGroups,
      recentOrders,
      paymentAlerts,
    ] = await this.db.$transaction([
      this.db.order.count(),
      this.db.order.count({ where: { createdAt: { gte: from, lte: now } } }),
      this.db.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          OR: [
            { paidAt: { gte: from, lte: now } },
            { paidAt: null, createdAt: { gte: from, lte: now } },
          ],
        },
        select: {
          paidAt: true,
          createdAt: true,
          paymentMethod: true,
          totalAmount: true,
          payment: { select: { receivedAmount: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.db.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.db.menuItem.count({ where: { isAvailable: true } }),
      this.db.order.groupBy({
        by: ["paymentStatus"],
        orderBy: { paymentStatus: "asc" },
        _count: { _all: true },
      }),
      this.db.order.groupBy({
        by: ["fulfillmentStatus"],
        orderBy: { fulfillmentStatus: "asc" },
        _count: { _all: true },
      }),
      this.db.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderCode: true,
          paymentMethod: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, fullName: true } },
          assignedBarista: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.db.order.findMany({
        where: { paymentStatus: { in: [...PAYMENT_ALERT_STATUSES] } },
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          orderCode: true,
          paymentStatus: true,
          totalAmount: true,
          updatedAt: true,
          payment: {
            select: {
              paymentCode: true,
              expectedAmount: true,
              receivedAmount: true,
            },
          },
        },
      }),
    ]);

    const ordersByPaymentStatus: Record<PaymentStatus, number> = {
      UNPAID: 0,
      PENDING: 0,
      PAID: 0,
      UNDERPAID: 0,
      OVERPAID: 0,
      REVIEW: 0,
    };
    for (const group of paymentStatusGroups) {
      ordersByPaymentStatus[group.paymentStatus] = readGroupCount(group._count);
    }

    const ordersByFulfillmentStatus: Record<FulfillmentStatus, number> = {
      PENDING_PAYMENT: 0,
      QUEUED: 0,
      PREPARING: 0,
      READY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    for (const group of fulfillmentStatusGroups) {
      ordersByFulfillmentStatus[group.fulfillmentStatus] = readGroupCount(
        group._count,
      );
    }

    const revenueSeries = createRevenueSeries(from, days);
    const revenueByPaymentMethod = {
      CASH: { amount: BigInt(0), orderCount: 0 },
      QR: { amount: BigInt(0), orderCount: 0 },
    };
    let grossRevenue = BigInt(0);
    let todayRevenue = BigInt(0);

    for (const order of paidOrders) {
      const amount = order.payment?.receivedAmount ?? order.totalAmount;
      const revenueAt = order.paidAt ?? order.createdAt;
      grossRevenue += amount;

      if (revenueAt >= todayFrom) {
        todayRevenue += amount;
      }

      if (
        order.paymentMethod === PaymentMethod.CASH ||
        order.paymentMethod === PaymentMethod.QR
      ) {
        revenueByPaymentMethod[order.paymentMethod].amount += amount;
        revenueByPaymentMethod[order.paymentMethod].orderCount += 1;
      }

      const orderDate = vietnamDateKey(revenueAt);
      const orderHour = days === 1 ? vietnamHour(revenueAt) : undefined;
      const point = revenueSeries.find(
        (entry) => entry.date === orderDate && entry.hour === orderHour,
      );
      if (point) {
        point.revenue += amount;
        point.orderCount += 1;
      }
    }

    const paymentReviewOrderCount =
      ordersByPaymentStatus.UNDERPAID +
      ordersByPaymentStatus.OVERPAID +
      ordersByPaymentStatus.REVIEW;
    const activeOrderCount =
      ordersByFulfillmentStatus.PENDING_PAYMENT +
      ordersByFulfillmentStatus.QUEUED +
      ordersByFulfillmentStatus.PREPARING +
      ordersByFulfillmentStatus.READY;

    return {
      generatedAt: now,
      timeZone: "Asia/Ho_Chi_Minh",
      range: { from, to: now, days },
      summary: {
        totalOrderCount,
        rangeOrderCount,
        paidOrderCount: paidOrders.length,
        grossRevenue,
        todayRevenue,
        averagePaidOrderValue:
          paidOrders.length > 0
            ? grossRevenue / BigInt(paidOrders.length)
            : BigInt(0),
      },
      health: {
        activeOrderCount,
        pendingPaymentOrderCount:
          ordersByFulfillmentStatus.PENDING_PAYMENT,
        queuedOrderCount: ordersByFulfillmentStatus.QUEUED,
        preparingOrderCount: ordersByFulfillmentStatus.PREPARING,
        readyOrderCount: ordersByFulfillmentStatus.READY,
        paymentReviewOrderCount,
        activeUserCount,
        availableMenuItemCount,
      },
      ordersByPaymentStatus,
      ordersByFulfillmentStatus,
      revenueByPaymentMethod,
      revenueSeries,
      recentOrders: recentOrders.map(({ _count, ...order }) => ({
        ...order,
        itemCount: _count.items,
      })),
      paymentAlerts,
    };
  }
}

function readGroupCount(value: true | { _all?: number } | undefined): number {
  return typeof value === "object" && typeof value._all === "number"
    ? value._all
    : 0;
}

function startOfVietnamDay(date: Date, daysAgo: number): Date {
  const shifted = new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysAgo,
    ) - VIETNAM_UTC_OFFSET_MS,
  );
}

function vietnamDateKey(date: Date): string {
  return new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function vietnamHour(date: Date): number {
  return new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS).getUTCHours();
}

function createRevenueSeries(from: Date, days: number) {
  if (days === 1) {
    return Array.from({ length: 24 }, (_, hour) => ({
      date: vietnamDateKey(from),
      hour,
      revenue: BigInt(0),
      orderCount: 0,
    }));
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getTime() + index * 24 * 60 * 60 * 1000);
    return {
      date: vietnamDateKey(date),
      hour: undefined,
      revenue: BigInt(0),
      orderCount: 0,
    };
  });
}
