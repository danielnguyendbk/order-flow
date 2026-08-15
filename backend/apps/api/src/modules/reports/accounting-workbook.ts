import {
  AuditEntityType,
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
  ResolutionAction,
  TransactionMatchStatus,
  type PrismaClient,
} from "@prisma/client";
import ExcelJS from "exceljs";
import type { RevenueReportInput, RevenueReportService } from "./revenue.service";

type RevenueReport = Awaited<ReturnType<RevenueReportService["getRevenueReport"]>>;

export type IssueSeverity = "CRITICAL" | "DIFFERENCE" | "REVIEW" | "MISSING" | "INFO";

interface AccountingIssue {
  severity: IssueSeverity;
  code: string;
  source: "Tổng quan" | "Đơn hàng" | "Payments" | "SePay" | "Hoàn tiền";
  reference: string;
  expected?: bigint;
  actual?: bigint;
  difference?: bigint;
  message: string;
  action: string;
}

interface ExportOrder {
  id: string;
  orderCode: string;
  createdAt: Date;
  paidAt: Date | null;
  creatorName: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalAmount: bigint;
  itemTotal: bigint;
  itemSummary: string;
  payment: {
    id: string;
    paymentCode: string | null;
    expectedAmount: bigint;
    receivedAmount: bigint;
    confirmedAt: Date | null;
    cashConfirmedByUserId: string | null;
  } | null;
}

interface ExportPayment {
  id: string;
  orderId: string;
  orderCode: string;
  orderPaymentStatus: PaymentStatus;
  orderFulfillmentStatus: FulfillmentStatus;
  orderTotalAmount: bigint;
  paymentMethod: PaymentMethod | null;
  paymentCode: string | null;
  expectedAmount: bigint;
  receivedAmount: bigint;
  confirmedAt: Date | null;
  cashConfirmer: string | null;
  createdAt: Date;
  updatedAt: Date;
  sepayTransactionCount: number;
  sepayAmount: bigint;
}

interface ExportSepayTransaction {
  id: string;
  sepayTransactionId: string;
  paymentId: string | null;
  orderCode: string | null;
  transactionDate: Date;
  receivedAt: Date;
  code: string | null;
  content: string | null;
  referenceCode: string | null;
  amountIn: bigint;
  expectedAmount: bigint | null;
  paymentReceivedAmount: bigint | null;
  matchStatus: TransactionMatchStatus;
  differenceAmount: bigint | null;
  resolutionAction: ResolutionAction;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

interface ExportRefund {
  auditId: string;
  paymentId: string | null;
  orderCode: string;
  paymentMethod: PaymentMethod | null;
  receivedAmount: bigint;
  refundAmount: bigint;
  reason: string;
  actorName: string | null;
  createdAt: Date;
}

interface AccountingEntry {
  date: Date;
  reference: string;
  description: string;
  paymentMethod: "CASH" | "QR";
  debitAccount: string;
  creditAccount: string;
  amount: bigint;
  netRevenue: bigint;
}

export interface AccountingExportData {
  orders: ExportOrder[];
  payments: ExportPayment[];
  sepayTransactions: ExportSepayTransaction[];
  refunds: ExportRefund[];
  entries: AccountingEntry[];
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  CRITICAL: 0,
  DIFFERENCE: 1,
  REVIEW: 2,
  MISSING: 3,
  INFO: 4,
};

const ISSUE_STYLE: Record<IssueSeverity, { fill: string; font: string; label: string }> = {
  CRITICAL: { fill: "FFFEE2E2", font: "FF991B1B", label: "Lỗi nghiêm trọng" },
  DIFFERENCE: { fill: "FFFFEDD5", font: "FF9A3412", label: "Chênh lệch số tiền" },
  REVIEW: { fill: "FFFEF3C7", font: "FF92400E", label: "Cần rà soát" },
  MISSING: { fill: "FFEDE9FE", font: "FF6D28D9", label: "Thiếu dữ liệu" },
  INFO: { fill: "FFDBEAFE", font: "FF1D4ED8", label: "Thông tin" },
};

export async function loadAccountingExportData(
  db: PrismaClient,
  input: RevenueReportInput,
): Promise<AccountingExportData> {
  const dateRange = { gte: input.from, lte: input.to };
  const refundRows = await db.auditLog.findMany({
    where: {
      action: "MANUAL_REFUND_RECORDED",
      entityType: AuditEntityType.PAYMENT,
      createdAt: dateRange,
    },
    include: { actor: true },
    orderBy: { createdAt: "asc" },
  });
  const refundedPaymentIds = refundRows
    .map((refund) => refund.entityId)
    .filter((paymentId): paymentId is string => paymentId !== null);

  const [orderRows, paymentRows, transactionRows] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          { createdAt: dateRange },
          { paidAt: dateRange },
          ...(refundedPaymentIds.length > 0 ? [{ payment: { id: { in: refundedPaymentIds } } }] : []),
        ],
      },
      include: { creator: true, items: true, payment: true },
      orderBy: { createdAt: "asc" },
    }),
    db.payment.findMany({
      where: {
        OR: [
          { createdAt: dateRange },
          { confirmedAt: dateRange },
          { updatedAt: dateRange },
          { order: { createdAt: dateRange } },
          { order: { paidAt: dateRange } },
          { sepayTransactions: { some: { OR: [{ transactionDate: dateRange }, { receivedAt: dateRange }] } } },
          ...(refundedPaymentIds.length > 0 ? [{ id: { in: refundedPaymentIds } }] : []),
        ],
      },
      include: { order: true, cashConfirmer: true, sepayTransactions: true },
      orderBy: { createdAt: "asc" },
    }),
    db.sepayTransaction.findMany({
      where: { OR: [{ transactionDate: dateRange }, { receivedAt: dateRange }] },
      include: { payment: { include: { order: true } }, resolvedBy: true },
      orderBy: { transactionDate: "asc" },
    }),
  ]);

  const orders: ExportOrder[] = orderRows.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    creatorName: order.creator.fullName,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalAmount: order.totalAmount,
    itemTotal: order.items.reduce((sum, item) => sum + item.unitPrice * BigInt(item.quantity), 0n),
    itemSummary: order.items.map((item) => `${item.itemName} x${item.quantity}`).join(", "),
    payment: order.payment ? {
      id: order.payment.id,
      paymentCode: order.payment.paymentCode,
      expectedAmount: order.payment.expectedAmount,
      receivedAmount: order.payment.receivedAmount,
      confirmedAt: order.payment.confirmedAt,
      cashConfirmedByUserId: order.payment.cashConfirmedByUserId,
    } : null,
  }));

  const payments: ExportPayment[] = paymentRows.map((payment) => ({
    id: payment.id,
    orderId: payment.orderId,
    orderCode: payment.order.orderCode,
    orderPaymentStatus: payment.order.paymentStatus,
    orderFulfillmentStatus: payment.order.fulfillmentStatus,
    orderTotalAmount: payment.order.totalAmount,
    paymentMethod: payment.order.paymentMethod,
    paymentCode: payment.paymentCode,
    expectedAmount: payment.expectedAmount,
    receivedAmount: payment.receivedAmount,
    confirmedAt: payment.confirmedAt,
    cashConfirmer: payment.cashConfirmer?.fullName ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    sepayTransactionCount: payment.sepayTransactions.length,
    sepayAmount: payment.sepayTransactions.reduce((sum, transaction) => sum + transaction.amountIn, 0n),
  }));

  const sepayTransactions: ExportSepayTransaction[] = transactionRows.map((transaction) => ({
    id: transaction.id,
    sepayTransactionId: transaction.sepayTransactionId,
    paymentId: transaction.paymentId,
    orderCode: transaction.payment?.order.orderCode ?? null,
    transactionDate: transaction.transactionDate,
    receivedAt: transaction.receivedAt,
    code: transaction.code,
    content: transaction.content,
    referenceCode: transaction.referenceCode,
    amountIn: transaction.amountIn,
    expectedAmount: transaction.payment?.expectedAmount ?? null,
    paymentReceivedAmount: transaction.payment?.receivedAmount ?? null,
    matchStatus: transaction.matchStatus,
    differenceAmount: transaction.differenceAmount,
    resolutionAction: transaction.resolutionAction,
    resolutionNote: transaction.resolutionNote,
    resolvedAt: transaction.resolvedAt,
    resolvedBy: transaction.resolvedBy?.fullName ?? null,
  }));

  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const refunds: ExportRefund[] = refundRows.map((refund) => {
    const details = refund.details as Record<string, unknown>;
    const paymentId = refund.entityId;
    return {
      auditId: refund.id.toString(),
      paymentId,
      orderCode: paymentId ? paymentById.get(paymentId)?.orderCode ?? String(details.orderCode ?? details.orderId ?? "KHÔNG_RÕ") : String(details.orderCode ?? details.orderId ?? "KHÔNG_RÕ"),
      paymentMethod: paymentId ? paymentById.get(paymentId)?.paymentMethod ?? parsePaymentMethod(details.paymentMethod) : parsePaymentMethod(details.paymentMethod),
      receivedAmount: paymentId ? paymentById.get(paymentId)?.receivedAmount ?? parseBigInt(details.receivedAmount) : parseBigInt(details.receivedAmount),
      refundAmount: parseBigInt(details.refundAmount),
      reason: String(details.reason ?? ""),
      actorName: refund.actor?.fullName ?? null,
      createdAt: refund.createdAt,
    };
  });

  const entries: AccountingEntry[] = [];
  for (const order of orders) {
    if (order.paymentStatus !== PaymentStatus.PAID) continue;
    const accountingDate = order.paidAt ?? order.createdAt;
    if (!isWithinRange(accountingDate, input)) continue;
    if (order.paymentMethod !== PaymentMethod.CASH && order.paymentMethod !== PaymentMethod.QR) continue;
    const method = order.paymentMethod;
    const amount = order.payment?.receivedAmount ?? order.totalAmount;
    entries.push({
      date: accountingDate,
      reference: order.orderCode,
      description: `Thu tiền ${order.itemSummary}`,
      paymentMethod: method,
      debitAccount: method === "CASH" ? "1111" : "1121",
      creditAccount: "5113",
      amount,
      netRevenue: amount,
    });
  }
  for (const refund of refunds) {
    if (refund.paymentMethod !== PaymentMethod.CASH && refund.paymentMethod !== PaymentMethod.QR) continue;
    const method = refund.paymentMethod;
    entries.push({
      date: refund.createdAt,
      reference: refund.orderCode,
      description: `Hoàn tiền${refund.reason ? `: ${refund.reason}` : ""}`,
      paymentMethod: method,
      debitAccount: "5212",
      creditAccount: method === "CASH" ? "1111" : "1121",
      amount: refund.refundAmount,
      netRevenue: -refund.refundAmount,
    });
  }

  return {
    orders,
    payments,
    sepayTransactions,
    refunds,
    entries: entries.sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
}

export async function createAccountingWorkbook(
  report: RevenueReport,
  data: AccountingExportData,
): Promise<Buffer> {
  const issues = buildIssues(report, data);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Order Flow";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = buildSummarySheet(workbook, report, data, issues);
  const issuesSheet = buildIssuesSheet(workbook, issues);
  const ordersSheet = buildOrdersSheet(workbook, data, issues);
  const paymentsSheet = buildPaymentsSheet(workbook, data, issues);
  const sepaySheet = buildSepaySheet(workbook, data, issues);
  const refundsSheet = buildRefundsSheet(workbook, data, issues);
  const journalSheet = buildJournalSheet(workbook, report, data.entries);
  const dailySheet = buildDailySheet(workbook, report);

  for (const sheet of [summary, issuesSheet, ordersSheet, paymentsSheet, sepaySheet, refundsSheet, journalSheet, dailySheet]) {
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  report: RevenueReport,
  data: AccountingExportData,
  issues: AccountingIssue[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("Tổng quan", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "BÁO CÁO KIỂM SOÁT DOANH THU VÀ THANH TOÁN";
  sheet.getCell("A2").value = "Kỳ báo cáo";
  sheet.getCell("B2").value = `${formatDate(report.range.from)} - ${formatDate(report.range.to)}`;
  sheet.getCell("D2").value = "Đơn vị";
  sheet.getCell("E2").value = "VND";

  const criticalCount = issues.filter((issue) => issue.severity === "CRITICAL").length;
  const warningCount = issues.filter((issue) => issue.severity !== "CRITICAL" && issue.severity !== "INFO").length;
  const infoCount = issues.filter((issue) => issue.severity === "INFO").length;
  sheet.getCell("A4").value = "TRẠNG THÁI KIỂM SOÁT";
  sheet.getCell("B4").value = criticalCount > 0 ? "FAIL" : warningCount > 0 ? "WARNING" : "OK";
  sheet.getCell("D4").value = "Lỗi nghiêm trọng";
  sheet.getCell("E4").value = criticalCount;
  sheet.getCell("F4").value = "Cảnh báo / thông tin";
  sheet.getCell("G4").value = `${warningCount} / ${infoCount}`;
  applyStatusCell(sheet.getCell("B4"), criticalCount > 0 ? "CRITICAL" : warningCount > 0 ? "REVIEW" : null);

  sheet.addRow([]);
  sheet.addRow(["Chỉ tiêu", "Giá trị", "Chứng từ", "Nguồn đối chiếu", "Ghi chú"]);
  const summaryRows = [
    ["Doanh thu gộp", Number(report.summary.grossRevenue), report.summary.paidOrderCount, "Đơn PAID / Payment", "Trước hoàn tiền"],
    ["Hoàn tiền", Number(report.summary.refundedAmount), report.summary.refundCount, "Audit hoàn tiền", "Điều chỉnh giảm doanh thu"],
    ["Doanh thu thuần", formula("B7-B8", report.summary.netRevenue), report.summary.paidOrderCount, "Nhật ký kế toán", "Doanh thu gộp - hoàn tiền"],
    ["Tổng Payment trong phạm vi", Number(data.payments.reduce((sum, payment) => sum + payment.receivedAmount, 0n)), data.payments.length, "Payments", "Kể cả trạng thái cần rà soát"],
    ["Tổng giao dịch SePay", Number(data.sepayTransactions.reduce((sum, transaction) => sum + transaction.amountIn, 0n)), data.sepayTransactions.length, "SePay", "Matched / unmatched / reviewed"],
    ["Đơn hàng trong phạm vi", data.orders.length, data.orders.length, "Đơn hàng", "Kể cả chưa thanh toán / đã hủy"],
  ];
  summaryRows.forEach((row) => {
    const added = sheet.addRow(row);
    added.height = 34;
    added.alignment = { vertical: "middle", wrapText: true };
    added.getCell(4).alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
    added.getCell(5).alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
    added.getCell(5).border = { left: { style: "thin", color: { argb: "FFE2E8F0" } } };
  });
  sheet.getColumn(2).numFmt = "#,##0;[Red](#,##0);-";

  sheet.addRow([]);
  const checkHeaderRow = sheet.addRow(["KIỂM TRA CHÉO", "Báo cáo", "Sổ chi tiết", "Chênh lệch", "Kết quả", "Ghi chú"]);
  const entryGross = data.entries.reduce((sum, entry) => sum + (entry.netRevenue > 0n ? entry.amount : 0n), 0n);
  const entryRefunds = data.entries.reduce((sum, entry) => sum + (entry.netRevenue < 0n ? entry.amount : 0n), 0n);
  const entryNet = data.entries.reduce((sum, entry) => sum + entry.netRevenue, 0n);
  const checks = [
    ["Doanh thu gộp", report.summary.grossRevenue, entryGross, "GROSS_REVENUE_TIE_OUT"],
    ["Hoàn tiền", report.summary.refundedAmount, entryRefunds, "REFUND_TIE_OUT"],
    ["Doanh thu thuần", report.summary.netRevenue, entryNet, "NET_REVENUE_TIE_OUT"],
  ] as const;
  checks.forEach(([label, expected, actual, code]) => {
    const row = sheet.addRow([
      label,
      Number(expected),
      Number(actual),
      formula(`C${sheet.rowCount + 1}-B${sheet.rowCount + 1}`, actual - expected),
      expected === actual ? "OK" : "FAIL",
      expected === actual ? "Khớp báo cáo doanh thu" : `Xem mã ${code} trong sheet Kiểm tra sai lệch`,
    ]);
    row.height = 28;
    row.alignment = { vertical: "middle", wrapText: true };
    applyStatusCell(row.getCell(5), expected === actual ? null : "CRITICAL");
    if (expected !== actual) emphasizeCell(row.getCell(4), "CRITICAL", `${code}: số liệu báo cáo không khớp sổ chi tiết.`);
  });
  setMoneyColumns(sheet, [2, 3, 4]);

  sheet.addRow([]);
  const legendHeaderRow = sheet.addRow(["MÀU", "NHÓM LỖI", "Ý NGHĨA", "HƯỚNG XỬ LÝ"]);
  (Object.keys(ISSUE_STYLE) as IssueSeverity[]).forEach((severity) => {
    const style = ISSUE_STYLE[severity];
    const row = sheet.addRow(["", style.label, issueMeaning(severity), issueDefaultAction(severity)]);
    row.height = 48;
    row.alignment = { vertical: "middle", wrapText: true };
    row.font = { name: "Arial", size: 9 };
    row.getCell(1).fill = solidFill(style.fill);
    row.getCell(2).font = { bold: true, color: { argb: style.font } };
  });
  const okRow = sheet.addRow(["", "Hợp lệ", "Không phát hiện sai lệch theo các quy tắc kiểm tra", "Không cần xử lý"]);
  okRow.height = 42;
  okRow.alignment = { vertical: "middle", wrapText: true };
  okRow.font = { name: "Arial", size: 9 };
  okRow.getCell(1).fill = solidFill("FFDCFCE7");
  okRow.getCell(2).font = { bold: true, color: { argb: "FF166534" } };

  const noteRow = sheet.rowCount + 2;
  sheet.mergeCells(`A${noteRow}:G${noteRow}`);
  const note = sheet.getCell(`A${noteRow}`);
  note.value = "Lưu ý: màu và mã lỗi hỗ trợ kiểm soát nội bộ; cần đối chiếu sao kê, hóa đơn và chứng từ gốc trước khi hạch toán/nộp báo cáo.";
  note.note = "Các quy tắc được mô tả chi tiết trong sheet 'Kiểm tra sai lệch'.";
  note.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(noteRow).height = 38;
  styleTitle(sheet, 8);
  styleHeader(sheet.getRow(6));
  styleHeader(checkHeaderRow);
  styleHeader(legendHeaderRow);
  sheet.getRow(4).height = 28;
  sheet.getRow(4).alignment = { vertical: "middle", wrapText: true };
  setWidths(sheet, [21, 18, 14, 25, 36, 20, 16]);
  return sheet;
}

function buildIssuesSheet(workbook: ExcelJS.Workbook, issues: AccountingIssue[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Kiểm tra sai lệch", "DANH SÁCH LỖI VÀ SAI KHÁC", [
    "STT", "Mức độ", "Mã lỗi", "Nguồn", "Tham chiếu", "Số đúng/kỳ vọng", "Số thực tế", "Chênh lệch", "Mô tả", "Hướng xử lý",
  ]);
  issues.forEach((issue, index) => {
    const row = sheet.addRow([
      index + 1, issue.severity, issue.code, issue.source, issue.reference,
      issue.expected === undefined ? null : Number(issue.expected),
      issue.actual === undefined ? null : Number(issue.actual),
      issue.difference === undefined ? null : Number(issue.difference),
      issue.message, issue.action,
    ]);
    applyIssueRow(row, issue.severity, 3, issue);
  });
  setMoneyColumns(sheet, [6, 7, 8]);
  setWidths(sheet, [7, 18, 28, 16, 22, 18, 18, 18, 52, 52]);
  finishDataSheet(sheet);
  return sheet;
}

function buildOrdersSheet(workbook: ExcelJS.Workbook, data: AccountingExportData, issues: AccountingIssue[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Đơn hàng", "TOÀN BỘ ĐƠN HÀNG VÀ DOANH THU TRONG PHẠM VI", [
    "STT", "Ngày tạo", "Ngày thanh toán", "Mã đơn", "Người tạo", "Phương thức", "TT thanh toán", "TT thực hiện",
    "Chi tiết món", "Tổng theo món", "Tổng đơn", "Lệch tổng", "Payment ID", "Phải thu", "Đã thu", "Hoàn tiền",
    "Doanh thu ghi nhận", "Mã lỗi", "Chú thích",
  ], "Gồm đơn tạo/thanh toán trong kỳ và đơn liên quan khoản hoàn trong kỳ - Đơn vị tiền: VND");
  const refundsByPayment = sumRefundsByPayment(data.refunds);
  data.orders.forEach((order, index) => {
    const excelRow = sheet.rowCount + 1;
    const rowIssues = issuesFor(issues, "Đơn hàng", order.orderCode);
    const refund = order.payment ? refundsByPayment.get(order.payment.id) ?? 0n : 0n;
    const recognized = order.paymentStatus === PaymentStatus.PAID
      ? (order.payment?.receivedAmount ?? order.totalAmount) - refund
      : 0n;
    const row = sheet.addRow([
      index + 1, order.createdAt, order.paidAt, order.orderCode, order.creatorName, order.paymentMethod,
      order.paymentStatus, order.fulfillmentStatus, order.itemSummary, Number(order.itemTotal), Number(order.totalAmount),
      formula(`K${excelRow}-J${excelRow}`, order.totalAmount - order.itemTotal), order.payment?.id ?? null,
      order.payment ? Number(order.payment.expectedAmount) : null,
      order.payment ? Number(order.payment.receivedAmount) : null,
      Number(refund), formula(`IF(G${excelRow}="PAID",O${excelRow}-P${excelRow},0)`, recognized),
      rowIssues.map((issue) => issue.code).join("; "), issueNotes(rowIssues),
    ]);
    applyIssuesToRow(row, rowIssues, 18);
    emphasizeIssueCells(row, rowIssues, "Đơn hàng");
  });
  setDateColumns(sheet, [2, 3]);
  setMoneyColumns(sheet, [10, 11, 12, 14, 15, 16, 17]);
  setWidths(sheet, [7, 18, 18, 16, 22, 14, 18, 18, 42, 16, 16, 16, 38, 16, 16, 16, 18, 32, 58]);
  finishDataSheet(sheet);
  return sheet;
}

function buildPaymentsSheet(workbook: ExcelJS.Workbook, data: AccountingExportData, issues: AccountingIssue[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Payments", "TOÀN BỘ BẢN GHI PAYMENT VÀ ĐỐI CHIẾU", [
    "STT", "Payment ID", "Mã đơn", "TT thanh toán", "TT thực hiện", "Phương thức", "Mã thanh toán", "Tổng đơn",
    "Phải thu", "Lệch phải thu/đơn", "Đã thu", "Lệch thu/phải thu", "Tổng SePay", "Lệch SePay/đã thu",
    "Hoàn trong kỳ", "Còn lại sau hoàn", "Ngày xác nhận", "Người xác nhận tiền mặt", "Số GD SePay", "Ngày tạo", "Cập nhật",
    "Mã lỗi", "Chú thích",
  ], "Gồm Payment tạo/xác nhận/cập nhật hoặc liên quan đơn, SePay, hoàn tiền trong kỳ - Đơn vị tiền: VND");
  const refundsByPayment = sumRefundsByPayment(data.refunds);
  data.payments.forEach((payment, index) => {
    const excelRow = sheet.rowCount + 1;
    const rowIssues = issuesFor(issues, "Payments", payment.id);
    const refunded = refundsByPayment.get(payment.id) ?? 0n;
    const row = sheet.addRow([
      index + 1, payment.id, payment.orderCode, payment.orderPaymentStatus, payment.orderFulfillmentStatus,
      payment.paymentMethod, payment.paymentCode, Number(payment.orderTotalAmount), Number(payment.expectedAmount),
      formula(`I${excelRow}-H${excelRow}`, payment.expectedAmount - payment.orderTotalAmount),
      Number(payment.receivedAmount), formula(`K${excelRow}-I${excelRow}`, payment.receivedAmount - payment.expectedAmount),
      Number(payment.sepayAmount), formula(`M${excelRow}-K${excelRow}`, payment.sepayAmount - payment.receivedAmount),
      Number(refunded), formula(`K${excelRow}-O${excelRow}`, payment.receivedAmount - refunded),
      payment.confirmedAt, payment.cashConfirmer, payment.sepayTransactionCount, payment.createdAt, payment.updatedAt,
      rowIssues.map((issue) => issue.code).join("; "), issueNotes(rowIssues),
    ]);
    applyIssuesToRow(row, rowIssues, 22);
    emphasizeIssueCells(row, rowIssues, "Payments");
  });
  setDateColumns(sheet, [17, 20, 21]);
  setMoneyColumns(sheet, [8, 9, 10, 11, 12, 13, 14, 15, 16]);
  setWidths(sheet, [7, 38, 16, 18, 18, 14, 20, 16, 16, 18, 16, 18, 16, 18, 16, 18, 19, 24, 12, 19, 19, 38, 60]);
  finishDataSheet(sheet);
  return sheet;
}

function buildSepaySheet(workbook: ExcelJS.Workbook, data: AccountingExportData, issues: AccountingIssue[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "SePay", "GIAO DỊCH SEPAY VÀ TRẠNG THÁI ĐỐI SOÁT", [
    "STT", "Ngày giao dịch", "Ngày nhận", "SePay transaction ID", "Code", "Nội dung", "Reference", "Tiền vào",
    "Match status", "Payment ID", "Mã đơn", "Payment phải thu", "Payment đã thu", "Lệch ghi nhận", "Resolution",
    "Ghi chú xử lý", "Ngày xử lý", "Người xử lý", "Mã lỗi", "Chú thích",
  ]);
  data.sepayTransactions.forEach((transaction, index) => {
    const rowIssues = issuesFor(issues, "SePay", transaction.sepayTransactionId);
    const row = sheet.addRow([
      index + 1, transaction.transactionDate, transaction.receivedAt, transaction.sepayTransactionId, transaction.code,
      transaction.content, transaction.referenceCode, Number(transaction.amountIn), transaction.matchStatus,
      transaction.paymentId, transaction.orderCode,
      transaction.expectedAmount === null ? null : Number(transaction.expectedAmount),
      transaction.paymentReceivedAmount === null ? null : Number(transaction.paymentReceivedAmount),
      transaction.differenceAmount === null ? null : Number(transaction.differenceAmount),
      transaction.resolutionAction, transaction.resolutionNote, transaction.resolvedAt, transaction.resolvedBy,
      rowIssues.map((issue) => issue.code).join("; "), issueNotes(rowIssues),
    ]);
    applyIssuesToRow(row, rowIssues, 19);
    emphasizeIssueCells(row, rowIssues, "SePay");
  });
  setDateColumns(sheet, [2, 3, 17]);
  setMoneyColumns(sheet, [8, 12, 13, 14]);
  setWidths(sheet, [7, 19, 19, 38, 18, 44, 24, 16, 18, 38, 16, 17, 17, 17, 20, 42, 19, 22, 34, 60]);
  finishDataSheet(sheet);
  return sheet;
}

function buildRefundsSheet(workbook: ExcelJS.Workbook, data: AccountingExportData, issues: AccountingIssue[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Hoàn tiền", "CÁC KHOẢN HOÀN TIỀN GHI NHẬN TRONG KỲ", [
    "STT", "Ngày hoàn", "Audit ID", "Payment ID", "Mã đơn", "Phương thức", "Số đã thu", "Số hoàn", "Còn lại",
    "Lý do", "Người ghi nhận", "Mã lỗi", "Chú thích",
  ]);
  data.refunds.forEach((refund, index) => {
    const excelRow = sheet.rowCount + 1;
    const reference = refund.paymentId ?? refund.auditId;
    const rowIssues = issuesFor(issues, "Hoàn tiền", reference);
    const row = sheet.addRow([
      index + 1, refund.createdAt, refund.auditId, refund.paymentId, refund.orderCode, refund.paymentMethod,
      Number(refund.receivedAmount), Number(refund.refundAmount), formula(`G${excelRow}-H${excelRow}`, refund.receivedAmount - refund.refundAmount),
      refund.reason, refund.actorName, rowIssues.map((issue) => issue.code).join("; "), issueNotes(rowIssues),
    ]);
    applyIssuesToRow(row, rowIssues, 12);
    emphasizeIssueCells(row, rowIssues, "Hoàn tiền");
  });
  setDateColumns(sheet, [2]);
  setMoneyColumns(sheet, [7, 8, 9]);
  setWidths(sheet, [7, 19, 16, 38, 16, 14, 16, 16, 16, 42, 22, 32, 60]);
  finishDataSheet(sheet);
  return sheet;
}

function buildJournalSheet(workbook: ExcelJS.Workbook, report: RevenueReport, entries: AccountingEntry[]): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Nhật ký kế toán", "NHẬT KÝ DOANH THU VÀ HOÀN TIỀN", [
    "STT", "Ngày hạch toán", "Số chứng từ", "Diễn giải", "Phương thức", "TK Nợ", "TK Có", "Phát sinh", "Giảm trừ", "Doanh thu thuần",
  ], `Từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} - Đơn vị: VND`);
  entries.forEach((entry, index) => {
    const excelRow = sheet.rowCount + 1;
    const isRefund = entry.netRevenue < 0n;
    sheet.addRow([
      index + 1, entry.date, entry.reference, entry.description, entry.paymentMethod, entry.debitAccount, entry.creditAccount,
      Number(isRefund ? 0n : entry.amount), Number(isRefund ? entry.amount : 0n), formula(`H${excelRow}-I${excelRow}`, entry.netRevenue),
    ]);
  });
  addTotals(sheet, 7, [8, 9, 10]);
  setDateColumns(sheet, [2]);
  setMoneyColumns(sheet, [8, 9, 10]);
  setWidths(sheet, [7, 19, 18, 48, 14, 10, 10, 17, 17, 18]);
  finishDataSheet(sheet);
  return sheet;
}

function buildDailySheet(workbook: ExcelJS.Workbook, report: RevenueReport): ExcelJS.Worksheet {
  const sheet = createDataSheet(workbook, "Tổng hợp ngày", "BẢNG TỔNG HỢP DOANH THU THEO NGÀY", [
    "STT", "Ngày", "Tiền mặt", "QR/Ngân hàng", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Số đơn", "Số hoàn",
  ], `Từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} - Đơn vị: VND`);
  report.byDate.forEach((item, index) => {
    const excelRow = sheet.rowCount + 1;
    sheet.addRow([
      index + 1, new Date(`${item.date}T00:00:00+07:00`), Number(item.cashAmount), Number(item.qrAmount),
      formula(`C${excelRow}+D${excelRow}`, item.grossRevenue), Number(item.refundedAmount),
      formula(`E${excelRow}-F${excelRow}`, item.netRevenue), item.orderCount, item.refundCount,
    ]);
  });
  addTotals(sheet, 2, [3, 4, 5, 6, 7, 8, 9]);
  setDateColumns(sheet, [2]);
  sheet.getColumn(2).numFmt = "dd/mm/yyyy";
  setMoneyColumns(sheet, [3, 4, 5, 6, 7]);
  setWidths(sheet, [7, 16, 17, 17, 18, 17, 18, 12, 12]);
  finishDataSheet(sheet);
  return sheet;
}

function buildIssues(report: RevenueReport, data: AccountingExportData): AccountingIssue[] {
  const issues: AccountingIssue[] = [];
  const refundByPayment = sumRefundsByPayment(data.refunds);
  const entryGross = data.entries.reduce((sum, entry) => sum + (entry.netRevenue > 0n ? entry.amount : 0n), 0n);
  const entryRefunds = data.entries.reduce((sum, entry) => sum + (entry.netRevenue < 0n ? entry.amount : 0n), 0n);
  const entryNet = data.entries.reduce((sum, entry) => sum + entry.netRevenue, 0n);

  if (entryGross !== report.summary.grossRevenue) {
    issues.push(issue("CRITICAL", "GROSS_REVENUE_TIE_OUT", "Tổng quan", "Doanh thu gộp", "Doanh thu gộp trên báo cáo không khớp nhật ký chi tiết.", "Kiểm tra ngày hạch toán, trạng thái PAID và Payment của đơn.", report.summary.grossRevenue, entryGross));
  }
  if (entryRefunds !== report.summary.refundedAmount) {
    issues.push(issue("CRITICAL", "REFUND_TIE_OUT", "Tổng quan", "Hoàn tiền", "Tổng hoàn tiền trên báo cáo không khớp nhật ký chi tiết.", "Kiểm tra audit MANUAL_REFUND_RECORDED và phạm vi ngày.", report.summary.refundedAmount, entryRefunds));
  }
  if (entryNet !== report.summary.netRevenue) {
    issues.push(issue("CRITICAL", "NET_REVENUE_TIE_OUT", "Tổng quan", "Doanh thu thuần", "Doanh thu thuần không khớp doanh thu gộp trừ hoàn tiền.", "Xử lý các lỗi đối chiếu doanh thu/hoàn tiền trước khi hạch toán.", report.summary.netRevenue, entryNet));
  }

  for (const order of data.orders) {
    if (order.totalAmount !== order.itemTotal) {
      issues.push(issue("CRITICAL", "ORDER_TOTAL_MISMATCH", "Đơn hàng", order.orderCode, "Tổng đơn khác tổng đơn giá x số lượng.", "Kiểm tra lại order_items và total_amount.", order.itemTotal, order.totalAmount));
    }
    if (order.paymentStatus === PaymentStatus.PAID && !order.payment) {
      issues.push(issue("CRITICAL", "PAID_NO_PAYMENT", "Đơn hàng", order.orderCode, "Đơn PAID nhưng không có bản ghi Payment.", "Khôi phục/tạo Payment và đối chiếu chứng từ thu tiền."));
    }
    if (order.paymentStatus === PaymentStatus.PAID && !order.paymentMethod) {
      issues.push(issue("CRITICAL", "PAID_NO_METHOD", "Đơn hàng", order.orderCode, "Đơn PAID nhưng thiếu phương thức thanh toán.", "Xác nhận CASH hay QR trước khi hạch toán."));
    }
    if (order.fulfillmentStatus === FulfillmentStatus.DELIVERED && order.paymentStatus !== PaymentStatus.PAID) {
      issues.push(issue("CRITICAL", "DELIVERED_NOT_PAID", "Đơn hàng", order.orderCode, "Đơn đã giao nhưng chưa ở trạng thái PAID.", "Đối chiếu thu tiền và cập nhật trạng thái thanh toán."));
    }
    if (order.paymentStatus === PaymentStatus.PAID && !order.paidAt) {
      issues.push(issue("MISSING", "PAID_AT_MISSING", "Đơn hàng", order.orderCode, "Đơn PAID nhưng thiếu thời điểm paid_at.", "Bổ sung thời điểm thanh toán từ Payment/sao kê."));
    }
    if (order.paymentStatus === PaymentStatus.UNDERPAID
      || order.paymentStatus === PaymentStatus.OVERPAID
      || order.paymentStatus === PaymentStatus.REVIEW) {
      issues.push(issue("REVIEW", `ORDER_${order.paymentStatus}`, "Đơn hàng", order.orderCode, `Đơn đang ở trạng thái ${order.paymentStatus}.`, "Hoàn tất đối soát trước khi ghi nhận doanh thu."));
    }
    if (order.paymentStatus === PaymentStatus.UNPAID || order.paymentStatus === PaymentStatus.PENDING) {
      issues.push(issue("INFO", `ORDER_${order.paymentStatus}`, "Đơn hàng", order.orderCode, "Đơn chưa đủ điều kiện ghi nhận doanh thu.", "Theo dõi, không đưa vào doanh thu thuần."));
    }
    if (order.fulfillmentStatus === FulfillmentStatus.CANCELLED && order.payment && order.payment.receivedAmount > 0n) {
      const refunded = refundByPayment.get(order.payment.id) ?? 0n;
      if (refunded < order.payment.receivedAmount) {
        issues.push(issue("CRITICAL", "CANCELLED_PAYMENT_NOT_REFUNDED", "Đơn hàng", order.orderCode, "Đơn đã hủy còn số tiền thu chưa hoàn đủ.", "Xác minh nghĩa vụ hoàn tiền và ghi nhận audit hoàn tiền.", order.payment.receivedAmount, refunded));
      }
    }
  }

  for (const payment of data.payments) {
    if (payment.expectedAmount !== payment.orderTotalAmount) {
      issues.push(issue("CRITICAL", "PAYMENT_EXPECTED_ORDER_MISMATCH", "Payments", payment.id, "Số phải thu trên Payment khác tổng tiền của đơn.", "Kiểm tra thời điểm tạo Payment và các lần sửa món/tổng đơn.", payment.orderTotalAmount, payment.expectedAmount));
    }
    const difference = payment.receivedAmount - payment.expectedAmount;
    if (difference < 0n) {
      issues.push(issue(payment.orderPaymentStatus === PaymentStatus.PAID ? "CRITICAL" : "DIFFERENCE", "PAYMENT_UNDERPAID", "Payments", payment.id, "Số đã thu thấp hơn số phải thu.", "Đối chiếu sao kê/tiền mặt và xử lý thiếu tiền.", payment.expectedAmount, payment.receivedAmount));
    } else if (difference > 0n) {
      issues.push(issue("DIFFERENCE", "PAYMENT_OVERPAID", "Payments", payment.id, "Số đã thu cao hơn số phải thu.", "Xác minh tiền thừa và phương án hoàn/điều chỉnh.", payment.expectedAmount, payment.receivedAmount));
    }
    if (payment.receivedAmount > 0n && !payment.confirmedAt) {
      issues.push(issue("MISSING", "PAYMENT_CONFIRMATION_MISSING", "Payments", payment.id, "Payment có số tiền thu nhưng thiếu confirmed_at.", "Bổ sung hoặc xác minh thời điểm xác nhận."));
    }
    if (payment.paymentMethod === PaymentMethod.QR && !payment.paymentCode) {
      issues.push(issue("MISSING", "QR_PAYMENT_CODE_MISSING", "Payments", payment.id, "Payment QR thiếu mã thanh toán.", "Kiểm tra quy trình khởi tạo QR và mã đối chiếu."));
    }
    if (payment.paymentMethod === PaymentMethod.CASH && payment.orderPaymentStatus === PaymentStatus.PAID && !payment.cashConfirmer) {
      issues.push(issue("MISSING", "CASH_CONFIRMER_MISSING", "Payments", payment.id, "Payment CASH đã PAID nhưng thiếu người xác nhận.", "Xác minh nhân viên thu tiền và bổ sung người xác nhận."));
    }
    if (payment.receivedAmount > 0n
      && (payment.orderPaymentStatus === PaymentStatus.UNPAID || payment.orderPaymentStatus === PaymentStatus.PENDING)) {
      issues.push(issue("CRITICAL", "RECEIVED_BUT_ORDER_UNPAID", "Payments", payment.id, "Payment đã có tiền nhưng đơn vẫn chưa thanh toán.", "Đối soát và đồng bộ trạng thái order/payment."));
    }
    if (payment.paymentMethod === PaymentMethod.QR && payment.sepayAmount !== payment.receivedAmount) {
      issues.push(issue("DIFFERENCE", "SEPAY_PAYMENT_MISMATCH", "Payments", payment.id, "Tổng giao dịch SePay liên kết khác received_amount.", "Kiểm tra giao dịch liên kết, giao dịch trùng hoặc ghi nhận thủ công.", payment.receivedAmount, payment.sepayAmount));
    }
    if (payment.paymentMethod === PaymentMethod.CASH && payment.sepayTransactionCount > 0) {
      issues.push(issue("CRITICAL", "CASH_HAS_SEPAY_TRANSACTION", "Payments", payment.id, "Payment tiền mặt lại có giao dịch SePay liên kết.", "Kiểm tra phương thức thanh toán và gỡ liên kết ngân hàng sai."));
    }
    const totalRefunded = refundByPayment.get(payment.id) ?? 0n;
    if (totalRefunded > payment.receivedAmount) {
      issues.push(issue("CRITICAL", "REFUND_TOTAL_EXCEEDS_RECEIVED", "Payments", payment.id, "Tổng hoàn trong kỳ lớn hơn số Payment đã thu.", "Dừng hạch toán hoàn tiền và kiểm tra bản ghi audit trùng/sai số tiền.", payment.receivedAmount, totalRefunded));
    }
  }

  for (const transaction of data.sepayTransactions) {
    const reference = transaction.sepayTransactionId;
    if (transaction.amountIn <= 0n) {
      issues.push(issue("CRITICAL", "SEPAY_NON_POSITIVE_AMOUNT", "SePay", reference, "Giao dịch SePay không có số tiền vào hợp lệ.", "Kiểm tra payload gốc và nguồn webhook."));
    }
    if (transaction.matchStatus === TransactionMatchStatus.MATCHED && !transaction.paymentId) {
      issues.push(issue("CRITICAL", "MATCHED_WITHOUT_PAYMENT", "SePay", reference, "Giao dịch MATCHED nhưng không liên kết Payment.", "Khôi phục liên kết Payment hoặc đưa giao dịch về trạng thái rà soát."));
    }
    if (transaction.matchStatus === TransactionMatchStatus.UNMATCHED) {
      issues.push(issue("REVIEW", "SEPAY_UNMATCHED", "SePay", reference, "Giao dịch SePay chưa khớp đơn hàng.", "Tìm mã thanh toán/số tiền và liên kết hoặc từ chối giao dịch."));
    }
    if (transaction.matchStatus === TransactionMatchStatus.WRONG_CODE) {
      issues.push(issue("REVIEW", "SEPAY_WRONG_CODE", "SePay", reference, "Nội dung chuyển khoản sai mã thanh toán.", "Đối chiếu thủ công với khách hàng và đơn hàng."));
    }
    if ((transaction.matchStatus === TransactionMatchStatus.UNMATCHED
      || transaction.matchStatus === TransactionMatchStatus.WRONG_CODE)
      && transaction.resolutionAction === ResolutionAction.NONE) {
      issues.push(issue("REVIEW", "SEPAY_UNRESOLVED", "SePay", reference, "Giao dịch cần rà soát nhưng chưa có hướng xử lý.", "Chọn hành động xử lý và ghi chú kết quả."));
    }
    if (transaction.expectedAmount !== null && transaction.paymentId && transaction.amountIn !== transaction.expectedAmount) {
      issues.push(issue("DIFFERENCE", "SEPAY_AMOUNT_MISMATCH", "SePay", reference, "Số tiền SePay khác số Payment phải thu.", "Xác minh thiếu/thừa tiền trước khi chấp nhận.", transaction.expectedAmount, transaction.amountIn));
    }
  }

  for (const refund of data.refunds) {
    const reference = refund.paymentId ?? refund.auditId;
    if (!refund.paymentId) {
      issues.push(issue("CRITICAL", "REFUND_PAYMENT_MISSING", "Hoàn tiền", reference, "Bản ghi hoàn tiền không có Payment ID.", "Xác minh và liên kết đúng Payment."));
    }
    if (!refund.paymentMethod) {
      issues.push(issue("MISSING", "REFUND_METHOD_MISSING", "Hoàn tiền", reference, "Bản ghi hoàn tiền thiếu phương thức chi trả.", "Xác nhận hoàn qua tiền mặt hay ngân hàng trước khi hạch toán."));
    }
    if (refund.refundAmount > refund.receivedAmount) {
      issues.push(issue("CRITICAL", "REFUND_EXCEEDS_RECEIVED", "Hoàn tiền", reference, "Số hoàn lớn hơn số đã thu.", "Kiểm tra lại số tiền hoàn và chứng từ.", refund.receivedAmount, refund.refundAmount));
    }
    const cumulativeRefund = refund.paymentId ? refundByPayment.get(refund.paymentId) ?? 0n : refund.refundAmount;
    if (cumulativeRefund > refund.receivedAmount && refund.refundAmount <= refund.receivedAmount) {
      issues.push(issue("CRITICAL", "REFUND_TOTAL_EXCEEDS_RECEIVED", "Hoàn tiền", reference, "Tổng các khoản hoàn trong kỳ lớn hơn số đã thu.", "Kiểm tra các audit hoàn tiền trùng và chứng từ chi tiền.", refund.receivedAmount, cumulativeRefund));
    }
    if (!refund.reason.trim()) {
      issues.push(issue("MISSING", "REFUND_REASON_MISSING", "Hoàn tiền", reference, "Bản ghi hoàn tiền thiếu lý do.", "Bổ sung lý do và chứng từ hỗ trợ."));
    }
    if (!refund.actorName) {
      issues.push(issue("MISSING", "REFUND_ACTOR_MISSING", "Hoàn tiền", reference, "Bản ghi hoàn tiền thiếu người thực hiện.", "Xác minh người duyệt/ghi nhận hoàn tiền và bổ sung dấu vết kiểm toán."));
    }
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.reference.localeCompare(b.reference));
}

function issue(
  severity: IssueSeverity,
  code: string,
  source: AccountingIssue["source"],
  reference: string,
  message: string,
  action: string,
  expected?: bigint,
  actual?: bigint,
): AccountingIssue {
  return { severity, code, source, reference, message, action, expected, actual, difference: expected === undefined || actual === undefined ? undefined : actual - expected };
}

function createDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  headers: string[],
  subtitle = "Dữ liệu nguồn từ Order Flow - Đơn vị tiền: VND",
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
  const lastColumn = columnLetter(headers.length);
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell("A1").value = title;
  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell("A2").value = subtitle;
  sheet.addRow(headers);
  styleTitle(sheet, headers.length);
  styleHeader(sheet.getRow(3));
  return sheet;
}

function finishDataSheet(sheet: ExcelJS.Worksheet): void {
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, sheet.rowCount), column: sheet.columnCount } };
  const hasLongTextColumns = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(3).getCell(index + 1).value)
    .some((value) => value === "Chú thích" || value === "Ghi chú" || value === "Hướng xử lý");
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return;
    row.height = hasLongTextColumns ? 48 : 24;
    row.alignment = { vertical: "middle", wrapText: true };
    row.eachCell((cell) => {
      cell.font = { ...cell.font, name: "Arial", size: 9 };
    });
  });
}

function styleTitle(sheet: ExcelJS.Worksheet, _columnCount: number): void {
  sheet.getCell("A1").font = { name: "Arial", size: 15, bold: true, color: { argb: "FF173F35" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;
}

function styleHeader(row: ExcelJS.Row): void {
  row.height = 38;
  row.eachCell((cell) => {
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solidFill("FF173F35");
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF173F35" } } };
  });
}

function applyIssuesToRow(row: ExcelJS.Row, issues: AccountingIssue[], issueColumn: number): void {
  if (issues.length === 0) {
    row.getCell(issueColumn).value = "OK";
    row.getCell(issueColumn).fill = solidFill("FFDCFCE7");
    row.getCell(issueColumn).font = { bold: true, color: { argb: "FF166534" } };
    return;
  }
  applyIssueRow(row, issues[0].severity, issueColumn, issues[0]);
  row.getCell(issueColumn).note = issues.map((item) => `${item.code}: ${item.message}\nXử lý: ${item.action}`).join("\n\n");
}

function emphasizeIssueCells(
  row: ExcelJS.Row,
  issues: AccountingIssue[],
  source: "Đơn hàng" | "Payments" | "SePay" | "Hoàn tiền",
): void {
  const byColumn = new Map<number, AccountingIssue[]>();
  issues.forEach((issue) => {
    issueCellColumns(source, issue.code).forEach((column) => {
      byColumn.set(column, [...(byColumn.get(column) ?? []), issue]);
    });
  });
  byColumn.forEach((cellIssues, column) => {
    const highest = [...cellIssues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
    emphasizeCell(
      row.getCell(column),
      highest.severity,
      cellIssues.map((issue) => `${issue.code}: ${issue.message}\nHướng xử lý: ${issue.action}`).join("\n\n"),
    );
  });
}

function emphasizeCell(cell: ExcelJS.Cell, severity: IssueSeverity, note: string): void {
  const style = ISSUE_STYLE[severity];
  cell.fill = solidFill(style.fill);
  cell.font = { ...cell.font, bold: true, color: { argb: style.font } };
  cell.border = {
    ...cell.border,
    top: { style: "medium", color: { argb: style.font } },
    bottom: { style: "medium", color: { argb: style.font } },
    left: { style: "medium", color: { argb: style.font } },
    right: { style: "medium", color: { argb: style.font } },
  };
  const existing = typeof cell.note === "string" ? cell.note : "";
  cell.note = existing ? `${existing}\n\n${note}` : note;
}

function issueCellColumns(
  source: "Đơn hàng" | "Payments" | "SePay" | "Hoàn tiền",
  code: string,
): number[] {
  const mappings: Record<typeof source, Record<string, number[]>> = {
    "Đơn hàng": {
      ORDER_TOTAL_MISMATCH: [10, 11, 12],
      PAID_NO_PAYMENT: [13],
      PAID_NO_METHOD: [6],
      DELIVERED_NOT_PAID: [7, 8],
      PAID_AT_MISSING: [3],
      ORDER_UNDERPAID: [7],
      ORDER_OVERPAID: [7],
      ORDER_REVIEW: [7],
      ORDER_UNPAID: [7],
      ORDER_PENDING: [7],
      CANCELLED_PAYMENT_NOT_REFUNDED: [8, 15, 16, 17],
    },
    Payments: {
      PAYMENT_EXPECTED_ORDER_MISMATCH: [8, 9, 10],
      PAYMENT_UNDERPAID: [9, 11, 12],
      PAYMENT_OVERPAID: [9, 11, 12],
      PAYMENT_CONFIRMATION_MISSING: [17],
      QR_PAYMENT_CODE_MISSING: [7],
      CASH_CONFIRMER_MISSING: [18],
      RECEIVED_BUT_ORDER_UNPAID: [4, 11],
      SEPAY_PAYMENT_MISMATCH: [11, 13, 14],
      CASH_HAS_SEPAY_TRANSACTION: [6, 13, 19],
      REFUND_TOTAL_EXCEEDS_RECEIVED: [11, 15, 16],
    },
    SePay: {
      SEPAY_NON_POSITIVE_AMOUNT: [8],
      MATCHED_WITHOUT_PAYMENT: [9, 10],
      SEPAY_UNMATCHED: [9, 15, 16],
      SEPAY_WRONG_CODE: [5, 6, 9],
      SEPAY_UNRESOLVED: [15, 16, 17, 18],
      SEPAY_AMOUNT_MISMATCH: [8, 12, 14],
    },
    "Hoàn tiền": {
      REFUND_PAYMENT_MISSING: [4],
      REFUND_METHOD_MISSING: [6],
      REFUND_EXCEEDS_RECEIVED: [7, 8, 9],
      REFUND_TOTAL_EXCEEDS_RECEIVED: [7, 8, 9],
      REFUND_REASON_MISSING: [10],
      REFUND_ACTOR_MISSING: [11],
    },
  };
  return mappings[source][code] ?? [];
}

function applyIssueRow(row: ExcelJS.Row, severity: IssueSeverity, issueColumn: number, issue: AccountingIssue): void {
  const style = ISSUE_STYLE[severity];
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = solidFill(style.fill);
  });
  const cell = row.getCell(issueColumn);
  cell.font = { bold: true, color: { argb: style.font } };
  cell.note = `${style.label}\n${issue.message}\nHướng xử lý: ${issue.action}`;
}

function applyStatusCell(cell: ExcelJS.Cell, severity: IssueSeverity | null): void {
  if (!severity) {
    cell.fill = solidFill("FFDCFCE7");
    cell.font = { bold: true, color: { argb: "FF166534" } };
    return;
  }
  const style = ISSUE_STYLE[severity];
  cell.fill = solidFill(style.fill);
  cell.font = { bold: true, color: { argb: style.font } };
}

function addTotals(sheet: ExcelJS.Worksheet, labelColumn: number, sumColumns: number[]): void {
  const totalRow = Math.max(5, sheet.rowCount + 1);
  sheet.getCell(totalRow, labelColumn).value = "CỘNG";
  sumColumns.forEach((column) => {
    const staticTotal = sheet.getColumn(column).values.slice(4).reduce<number>((sum, value) => sum + numericCellResult(value), 0);
    sheet.getCell(totalRow, column).value = { formula: `SUM(${columnLetter(column)}4:${columnLetter(column)}${totalRow - 1})`, result: staticTotal };
  });
  sheet.getRow(totalRow).font = { name: "Arial", size: 9, bold: true };
  sheet.getRow(totalRow).eachCell((cell) => {
    cell.border = { ...cell.border, top: { style: "double", color: { argb: "FF173F35" } } };
  });
}

function numericCellResult(value: ExcelJS.CellValue): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "result" in value && typeof value.result === "number") return value.result;
  return 0;
}

function setMoneyColumns(sheet: ExcelJS.Worksheet, columns: number[]): void {
  columns.forEach((column) => {
    sheet.getColumn(column).numFmt = "#,##0;[Red](#,##0);-";
    sheet.getColumn(column).alignment = { horizontal: "right", vertical: "middle" };
  });
}

function setDateColumns(sheet: ExcelJS.Worksheet, columns: number[]): void {
  columns.forEach((column) => {
    sheet.getColumn(column).numFmt = "dd/mm/yyyy hh:mm";
  });
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function issuesFor(issues: AccountingIssue[], source: AccountingIssue["source"], reference: string): AccountingIssue[] {
  return issues.filter((issue) => issue.source === source && issue.reference === reference);
}

function issueNotes(issues: AccountingIssue[]): string {
  return issues.map((issue) => `${ISSUE_STYLE[issue.severity].label}: ${issue.message} Xử lý: ${issue.action}`).join(" | ");
}

function sumRefundsByPayment(refunds: ExportRefund[]): Map<string, bigint> {
  const map = new Map<string, bigint>();
  refunds.forEach((refund) => {
    if (refund.paymentId) map.set(refund.paymentId, (map.get(refund.paymentId) ?? 0n) + refund.refundAmount);
  });
  return map;
}

function issueMeaning(severity: IssueSeverity): string {
  return {
    CRITICAL: "Sai trạng thái/liên kết hoặc số liệu có thể làm sai doanh thu",
    DIFFERENCE: "Số phải thu, đã thu, SePay hoặc hoàn tiền không bằng nhau",
    REVIEW: "Giao dịch đang chờ xử lý hoặc chưa được đối soát xong",
    MISSING: "Thiếu mã, thời điểm, người xác nhận hoặc chứng từ hỗ trợ",
    INFO: "Chưa đủ điều kiện ghi nhận doanh thu nhưng không phải lỗi hệ thống",
  }[severity];
}

function issueDefaultAction(severity: IssueSeverity): string {
  return {
    CRITICAL: "Dừng hạch toán dòng liên quan và xử lý ngay",
    DIFFERENCE: "Đối chiếu sao kê/chứng từ và xác nhận số đúng",
    REVIEW: "Hoàn tất quy trình đối soát",
    MISSING: "Bổ sung dữ liệu/chứng từ còn thiếu",
    INFO: "Theo dõi đến khi đủ điều kiện ghi nhận",
  }[severity];
}

function solidFill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function columnLetter(column: number): string {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function formula(expression: string, result: bigint | number) {
  return { formula: expression, result: Number(result) };
}

function isWithinRange(date: Date, input: RevenueReportInput): boolean {
  return date.getTime() >= input.from.getTime() && date.getTime() <= input.to.getTime();
}

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  return value === PaymentMethod.CASH || value === PaymentMethod.QR ? value : null;
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
