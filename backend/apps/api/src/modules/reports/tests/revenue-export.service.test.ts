import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import { RevenueExportService } from "../revenue-export.service";
import { parseRevenueExportInput } from "../revenue-export.validation";

const from = new Date("2026-08-01T00:00:00+07:00");
const to = new Date("2026-08-31T23:59:59.999+07:00");
const report = {
  range: { from: from.toISOString(), to: to.toISOString() },
  summary: {
    grossRevenue: 1_200_000n, refundedAmount: 200_000n, netRevenue: 1_000_000n,
    paidOrderCount: 2, refundCount: 1, totalDays: 31, avgDailyNetRevenue: 32_258n,
  },
  byMethod: {
    CASH: { amount: 500_000n, count: 1 },
    QR: { amount: 700_000n, count: 1 },
    REFUNDED: { amount: 200_000n, count: 1 },
  },
  byTime: [{
    time: "2026-08-01", cashAmount: 500_000n, qrAmount: 700_000n,
    grossRevenue: 1_200_000n, refundedAmount: 200_000n, netRevenue: 1_000_000n,
    orderCount: 2, refundCount: 1,
  }],
};
function createService() {
  const cashPayment = {
    id: "payment-1", orderId: "order-1", paymentCode: null,
    expectedAmount: 500_000n, receivedAmount: 500_000n,
    confirmedAt: new Date("2026-08-01T09:00:00+07:00"), cashConfirmedByUserId: null,
    createdAt: new Date("2026-08-01T08:50:00+07:00"), updatedAt: new Date("2026-08-01T09:00:00+07:00"),
  };
  const qrPayment = {
    id: "payment-2", orderId: "order-2", paymentCode: "OF0002",
    expectedAmount: 690_000n, receivedAmount: 700_000n,
    confirmedAt: new Date("2026-08-01T10:00:00+07:00"), cashConfirmedByUserId: null,
    createdAt: new Date("2026-08-01T09:50:00+07:00"), updatedAt: new Date("2026-08-01T10:00:00+07:00"),
  };
  const linkedSepay = {
    id: "sepay-1", sepayTransactionId: "SP-001", paymentId: "payment-2",
    transactionDate: new Date("2026-08-01T10:00:00+07:00"), receivedAt: new Date("2026-08-01T10:00:05+07:00"),
    code: "OF0002", content: "Thanh toan OF0002", referenceCode: "BANK-001", amountIn: 650_000n,
    matchStatus: "MATCHED", differenceAmount: -50_000n, resolutionAction: "NONE", resolutionNote: null,
    resolvedAt: null, resolvedBy: null,
  };
  const unmatchedSepay = {
    id: "sepay-2", sepayTransactionId: "SP-002", paymentId: null,
    transactionDate: new Date("2026-08-01T10:30:00+07:00"), receivedAt: new Date("2026-08-01T10:30:05+07:00"),
    code: null, content: "Chuyen khoan khong ma", referenceCode: "BANK-002", amountIn: 50_000n,
    matchStatus: "UNMATCHED", differenceAmount: null, resolutionAction: "NONE", resolutionNote: null,
    resolvedAt: null, resolvedBy: null, payment: null,
  };
  const order1 = {
    id: "order-1", orderCode: "OF0001", paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED",
    totalAmount: 500_000n, paidAt: new Date("2026-08-01T09:00:00+07:00"), createdAt: new Date("2026-08-01T08:50:00+07:00"),
    creator: { fullName: "Nhân viên A" }, payment: cashPayment,
    items: [{ itemName: "Cà phê sữa", quantity: 2, unitPrice: 250_000n }],
  };
  const order2 = {
    id: "order-2", orderCode: "OF0002", paymentMethod: "QR", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED",
    totalAmount: 700_000n, paidAt: new Date("2026-08-01T10:00:00+07:00"), createdAt: new Date("2026-08-01T09:50:00+07:00"),
    creator: { fullName: "Nhân viên B" }, payment: qrPayment,
    items: [{ itemName: "Trà đào", quantity: 1, unitPrice: 700_000n }],
  };
  const orderOutsideAccountingPeriod = {
    id: "order-3", orderCode: "OF0003", paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "DELIVERED",
    totalAmount: 300_000n, paidAt: new Date("2026-09-01T09:00:00+07:00"), createdAt: new Date("2026-08-31T23:30:00+07:00"),
    creator: { fullName: "Nhân viên C" },
    payment: { ...cashPayment, id: "payment-3", orderId: "order-3", expectedAmount: 300_000n, receivedAmount: 300_000n },
    items: [{ itemName: "Bạc xỉu", quantity: 1, unitPrice: 300_000n }],
  };
  const db = {
    order: { findMany: vi.fn().mockResolvedValue([order1, order2, orderOutsideAccountingPeriod]) },
    payment: { findMany: vi.fn().mockResolvedValue([
      { ...cashPayment, order: order1, cashConfirmer: null, sepayTransactions: [] },
      { ...qrPayment, order: order2, cashConfirmer: null, sepayTransactions: [linkedSepay] },
    ]) },
    sepayTransaction: { findMany: vi.fn().mockResolvedValue([
      { ...linkedSepay, payment: { ...qrPayment, order: order2 } }, unmatchedSepay,
    ]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([{
      id: 1n,
      entityId: "payment-1", createdAt: new Date("2026-08-01T11:00:00+07:00"),
      details: { orderCode: "OF0001", paymentMethod: "CASH", receivedAmount: "500000", refundAmount: "200000", reason: "Khách đổi món" },
      actor: { fullName: "Chủ cửa hàng" },
    }]) },
  };
  const reportService = { getRevenueReport: vi.fn().mockResolvedValue(report) };
  return new RevenueExportService(db as never, reportService as never);
}

describe("RevenueExportService", () => {
  it("creates an accounting workbook with reconciled net revenue", async () => {
    const result = await createService().export({ format: "xlsx", from, to });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "1.Tổng quan", "2.Kiểm tra sai lệch", "3.Đơn hàng", "4.Payments", "5.SePay", "6.Hoàn tiền",
      "7.Nhật ký kế toán", "8.Tổng hợp ngày", "9.Hướng dẫn",
    ]);
    const summary = workbook.getWorksheet("1.Tổng quan");
    expect(summary?.getCell("A1").value).toBe("ORDER FLOW");
    expect(summary?.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF1F4E78" } });
    expect(summary?.getCell("A2").font).toMatchObject({ name: "Arial", size: 11, bold: true });
    expect(summary?.getCell("A5").fill).toMatchObject({ fgColor: { argb: "FF2E75B6" } });
    expect(summary?.getCell("B10").value).toMatchObject({
      formula: "B8-B9", result: 1_000_000,
    });
    expect(summary?.getCell("E16").value).toBe("OK");
    expect(workbook.getWorksheet("7.Nhật ký kế toán")?.getCell("J9").value).toMatchObject({
      formula: "SUM(J6:J8)", result: 1_000_000,
    });
    const issueCodes = workbook.getWorksheet("2.Kiểm tra sai lệch")?.getColumn(3).values;
    expect(issueCodes).toContain("SEPAY_PAYMENT_MISMATCH");
    expect(issueCodes).toContain("PAYMENT_EXPECTED_ORDER_MISMATCH");
    expect(issueCodes).toContain("SEPAY_UNMATCHED");
    expect(issueCodes).toContain("CASH_CONFIRMER_MISSING");
    const paymentIssueCell = workbook.getWorksheet("4.Payments")?.getCell("V7");
    expect(paymentIssueCell?.fill).toMatchObject({ fgColor: { argb: "FFFEE2E2" } });
    expect(paymentIssueCell?.note).toBeTruthy();
    const expectedOrderDifference = workbook.getWorksheet("4.Payments")?.getCell("J7");
    expect(expectedOrderDifference?.fill).toMatchObject({ fgColor: { argb: "FFFEE2E2" } });
    expect(expectedOrderDifference?.font).toMatchObject({ bold: true });
    expect(expectedOrderDifference?.note).toBeTruthy();
    const sepayDifference = workbook.getWorksheet("4.Payments")?.getCell("N7");
    expect(sepayDifference?.fill).toMatchObject({ fgColor: { argb: "FFFFEDD5" } });
    expect(sepayDifference?.font).toMatchObject({ bold: true });
    const sepayIssueCell = workbook.getWorksheet("5.SePay")?.getCell("S7");
    expect(sepayIssueCell?.fill).toMatchObject({ fgColor: { argb: "FFFEF3C7" } });
    expect(sepayIssueCell?.note).toBeTruthy();
  });

  it("rejects the removed DOCX export formats", () => {
    expect(() => parseRevenueExportInput(
      { from: from.toISOString(), to: to.toISOString() },
      { format: "tax-revenue" },
    )).toThrow("Revenue export input is invalid");
  });
});
