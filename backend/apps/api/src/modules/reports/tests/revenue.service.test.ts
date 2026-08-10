import { AuditEntityType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { RevenueReportService } from "../revenue.service";

describe("RevenueReportService", () => {
  it("separates CASH, QR, REFUNDED and excludes refunds from net revenue", async () => {
    const db = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            paymentMethod: PaymentMethod.CASH,
            totalAmount: BigInt(100000),
            payment: { receivedAmount: BigInt(100000) },
          },
          {
            paymentMethod: PaymentMethod.QR,
            totalAmount: BigInt(90000),
            payment: { receivedAmount: BigInt(90000) },
          },
        ]),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            details: {
              refundAmount: "70000",
            },
          },
        ]),
      },
    };

    const from = new Date("2026-08-07T00:00:00.000+07:00");
    const to = new Date("2026-08-07T23:59:59.999+07:00");
    const report = await new RevenueReportService(db as any).getRevenueReport({ from, to });

    expect(db.order.findMany).toHaveBeenCalledWith({
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: from, lte: to },
      },
      include: { payment: true },
      orderBy: { paidAt: "asc" },
    });
    expect(db.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: "MANUAL_REFUND_RECORDED",
        entityType: AuditEntityType.PAYMENT,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(report.summary).toEqual({
      grossRevenue: BigInt(190000),
      refundedAmount: BigInt(70000),
      netRevenue: BigInt(120000),
      paidOrderCount: 2,
      refundCount: 1,
    });
    expect(report.byMethod).toEqual({
      CASH: { amount: BigInt(100000), count: 1 },
      QR: { amount: BigInt(90000), count: 1 },
      REFUNDED: { amount: BigInt(70000), count: 1 },
    });
  });
});
