import {
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { DashboardService } from "../dashboard.service.js";

describe("DashboardService", () => {
  it("builds revenue, health, status and daily chart data", async () => {
    const orderCount = vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(5);
    const orderFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          paidAt: new Date("2026-08-09T10:00:00.000Z"),
          createdAt: new Date("2026-08-09T09:00:00.000Z"),
          paymentMethod: PaymentMethod.CASH,
          totalAmount: 100_000n,
          payment: { receivedAmount: 100_000n },
        },
        {
          paidAt: null,
          createdAt: new Date("2026-08-10T01:00:00.000Z"),
          paymentMethod: PaymentMethod.QR,
          totalAmount: 200_000n,
          payment: { receivedAmount: 200_000n },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "order-1",
          orderCode: "ORD-001",
          paymentMethod: PaymentMethod.QR,
          paymentStatus: PaymentStatus.PAID,
          fulfillmentStatus: FulfillmentStatus.QUEUED,
          totalAmount: 200_000n,
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
          updatedAt: new Date("2026-08-10T01:00:00.000Z"),
          creator: { id: "staff-1", fullName: "Staff" },
          assignedBarista: null,
          _count: { items: 2 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "order-2",
          orderCode: "ORD-002",
          paymentStatus: PaymentStatus.UNDERPAID,
          totalAmount: 100_000n,
          updatedAt: new Date("2026-08-10T02:00:00.000Z"),
          payment: {
            paymentCode: "OF002",
            expectedAmount: 100_000n,
            receivedAmount: 90_000n,
          },
        },
      ]);
    const orderGroupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { paymentStatus: PaymentStatus.PAID, _count: { _all: 8 } },
        { paymentStatus: PaymentStatus.UNDERPAID, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        {
          fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
          _count: { _all: 2 },
        },
        {
          fulfillmentStatus: FulfillmentStatus.QUEUED,
          _count: { _all: 3 },
        },
      ]);
    const db = {
      order: {
        count: orderCount,
        findMany: orderFindMany,
        groupBy: orderGroupBy,
      },
      user: { count: vi.fn().mockResolvedValue(4) },
      menuItem: { count: vi.fn().mockResolvedValue(6) },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };

    const result = await new DashboardService(db as never).getDashboard({
      days: 2,
      now: new Date("2026-08-10T05:00:00.000Z"),
    });

    expect(result.summary).toEqual({
      totalOrderCount: 12,
      rangeOrderCount: 5,
      paidOrderCount: 2,
      grossRevenue: 300_000n,
      todayRevenue: 200_000n,
      averagePaidOrderValue: 150_000n,
    });
    expect(result.health).toMatchObject({
      activeOrderCount: 5,
      pendingPaymentOrderCount: 2,
      queuedOrderCount: 3,
      paymentReviewOrderCount: 1,
      activeUserCount: 4,
      availableMenuItemCount: 6,
    });
    expect(result.revenueByPaymentMethod).toEqual({
      CASH: { amount: 100_000n, orderCount: 1 },
      QR: { amount: 200_000n, orderCount: 1 },
    });
    expect(result.revenueSeries).toEqual([
      { date: "2026-08-09", revenue: 100_000n, orderCount: 1 },
      { date: "2026-08-10", revenue: 200_000n, orderCount: 1 },
    ]);
    expect(result.recentOrders[0]).toMatchObject({
      orderCode: "ORD-001",
      itemCount: 2,
    });
    expect(result.paymentAlerts[0]).toMatchObject({
      orderCode: "ORD-002",
      paymentStatus: PaymentStatus.UNDERPAID,
    });
  });

  it("returns 24 hourly revenue buckets in Asia/Ho_Chi_Minh", async () => {
    const orderFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          paidAt: new Date("2026-08-09T17:15:00.000Z"),
          createdAt: new Date("2026-08-09T17:00:00.000Z"),
          paymentMethod: PaymentMethod.CASH,
          totalAmount: 50_000n,
          payment: { receivedAmount: 50_000n },
        },
        {
          paidAt: new Date("2026-08-10T01:30:00.000Z"),
          createdAt: new Date("2026-08-10T01:00:00.000Z"),
          paymentMethod: PaymentMethod.QR,
          totalAmount: 100_000n,
          payment: { receivedAmount: 100_000n },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const db = {
      order: {
        count: vi.fn().mockResolvedValue(2),
        findMany: orderFindMany,
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: { count: vi.fn().mockResolvedValue(1) },
      menuItem: { count: vi.fn().mockResolvedValue(1) },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };

    const result = await new DashboardService(db as never).getDashboard({
      days: 1,
      now: new Date("2026-08-10T05:00:00.000Z"),
    });

    expect(result.revenueSeries).toHaveLength(24);
    expect(result.revenueSeries[0]).toEqual({
      date: "2026-08-10",
      hour: 0,
      revenue: 50_000n,
      orderCount: 1,
    });
    expect(result.revenueSeries[8]).toEqual({
      date: "2026-08-10",
      hour: 8,
      revenue: 100_000n,
      orderCount: 1,
    });
    expect(result.revenueSeries[23]).toEqual({
      date: "2026-08-10",
      hour: 23,
      revenue: 0n,
      orderCount: 0,
    });
  });
});
