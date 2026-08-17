import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../db";
import { createAccountingWorkbook as createControlWorkbook, loadAccountingExportData } from "./accounting-workbook";
import { RevenueReportService, type RevenueReportInput } from "./revenue.service";
import type { RevenueExportInput, TaxDeclarationInput } from "./revenue-export.validation";

export interface RevenueExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
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

interface RevenueReportPort {
  getRevenueReport(input: RevenueReportInput): Promise<Awaited<ReturnType<RevenueReportService["getRevenueReport"]>>>;
}

export class RevenueExportService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly revenueReportService: RevenueReportPort = new RevenueReportService(db),
    private readonly templateDirectory = defaultTemplateDirectory(),
  ) {}

  public async export(input: RevenueExportInput): Promise<RevenueExportResult> {
    const range = { from: input.from, to: input.to };
    const report = await this.revenueReportService.getRevenueReport(range);
    const period = `${localDateKey(input.from)}_${localDateKey(input.to)}`;

    if (input.format === "xlsx") {
      const data = await loadAccountingExportData(this.db, range);
      return {
        buffer: await createControlWorkbook(report, data),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `so-doanh-thu-${period}.xlsx`,
      };
    }

    const isRevenueExpense = input.format === "tax-revenue-expense";
    const templateName = isRevenueExpense
      ? "2._03.TNDN_2507200143.docx"
      : "15._04.TNDN_2507183508.docx";
    const template = await readFile(path.join(this.templateDirectory, templateName));
    const buffer = await createTaxDeclarationDocx(template, report, input, isRevenueExpense);

    return {
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${isRevenueExpense ? "03-TNDN-doanh-thu-chi-phi" : "04-TNDN-doanh-thu"}-${period}.docx`,
    };
  }

}

/** @deprecated Kept temporarily for backwards-compatible internal imports. */
export async function createLegacyAccountingWorkbook(
  report: Awaited<ReturnType<RevenueReportService["getRevenueReport"]>>,
  entries: AccountingEntry[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Order Flow";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = workbook.addWorksheet("Tổng hợp", { views: [{ state: "frozen", ySplit: 5 }] });
  summary.properties.defaultRowHeight = 20;
  summary.mergeCells("A1:F1");
  summary.getCell("A1").value = "BÁO CÁO DOANH THU VÀ ĐỐI CHIẾU KẾ TOÁN";
  summary.getCell("A2").value = "Kỳ báo cáo";
  summary.getCell("B2").value = `${formatDate(report.range.from)} - ${formatDate(report.range.to)}`;
  summary.getCell("A3").value = "Đơn vị tiền";
  summary.getCell("B3").value = "VND";
  summary.addRow([]);
  summary.addRow(["Chỉ tiêu", "Tiền mặt", "QR/Ngân hàng", "Hoàn tiền", "Doanh thu gộp", "Doanh thu thuần"]);
  summary.addRow([
    "Số tiền",
    Number(report.byMethod.CASH.amount),
    Number(report.byMethod.QR.amount),
    Number(report.summary.refundedAmount),
    Number(report.summary.grossRevenue),
    Number(report.summary.netRevenue),
  ]);
  summary.addRow([
    "Số chứng từ",
    report.byMethod.CASH.count,
    report.byMethod.QR.count,
    report.summary.refundCount,
    report.summary.paidOrderCount,
    report.summary.paidOrderCount - report.summary.refundCount,
  ]);
  summary.addRow([]);
  summary.mergeCells("A9:F9");
  summary.getCell("A9").value =
    "Phạm vi: số liệu bán hàng và hoàn tiền trong Order Flow; chưa bao gồm VAT, hóa đơn đầu vào và chi phí vì hệ thống chưa lưu các dữ liệu này.";

  const journal = workbook.addWorksheet("Nhật ký doanh thu", { views: [{ state: "frozen", ySplit: 4 }] });
  journal.mergeCells("A1:J1");
  journal.getCell("A1").value = "NHẬT KÝ DOANH THU";
  journal.mergeCells("A2:J2");
  journal.getCell("A2").value = `Từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} - Đơn vị: VND`;
  journal.addRow([
    "STT",
    "Ngày hạch toán",
    "Số chứng từ",
    "Diễn giải",
    "Phương thức",
    "TK Nợ",
    "TK Có",
    "Số tiền",
    "Điều chỉnh giảm",
    "Doanh thu thuần",
  ]);
  entries.forEach((entry, index) => {
    const isRefund = entry.netRevenue < 0n;
    journal.addRow([
      index + 1,
      entry.date,
      entry.reference,
      entry.description,
      entry.paymentMethod,
      entry.debitAccount,
      entry.creditAccount,
      Number(isRefund ? 0n : entry.amount),
      Number(isRefund ? entry.amount : 0n),
      Number(entry.netRevenue),
    ]);
  });
  const journalTotalRow = Math.max(5, journal.rowCount + 1);
  journal.getCell(`G${journalTotalRow}`).value = "CỘNG";
  for (const column of ["H", "I", "J"] as const) {
    const values = entries.reduce((sum, entry) => {
      if (column === "H") return sum + (entry.netRevenue >= 0n ? entry.amount : 0n);
      if (column === "I") return sum + (entry.netRevenue < 0n ? entry.amount : 0n);
      return sum + entry.netRevenue;
    }, 0n);
    journal.getCell(`${column}${journalTotalRow}`).value = {
      formula: `SUM(${column}4:${column}${journalTotalRow - 1})`,
      result: Number(values),
    };
  }

  const daily = workbook.addWorksheet("Tổng hợp ngày", { views: [{ state: "frozen", ySplit: 4 }] });
  daily.mergeCells("A1:H1");
  daily.getCell("A1").value = "BẢNG TỔNG HỢP DOANH THU THEO NGÀY";
  daily.mergeCells("A2:H2");
  daily.getCell("A2").value = `Từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} - Đơn vị: VND`;
  daily.addRow(["STT", "Ngày", "Tiền mặt", "QR/Ngân hàng", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Số đơn"]);
  report.byTime.forEach((item, index) => {
    daily.addRow([
      index + 1,
      new Date(`${item.time}T00:00:00+07:00`),
      Number(item.cashAmount),
      Number(item.qrAmount),
      Number(item.grossRevenue),
      Number(item.refundedAmount),
      Number(item.netRevenue),
      item.orderCount,
    ]);
  });
  const dailyTotalRow = daily.rowCount + 1;
  daily.getCell(`B${dailyTotalRow}`).value = "CỘNG";
  for (const column of ["C", "D", "E", "F", "G", "H"] as const) {
    daily.getCell(`${column}${dailyTotalRow}`).value = {
      formula: `SUM(${column}4:${column}${dailyTotalRow - 1})`,
      result:
        column === "C" ? Number(report.byMethod.CASH.amount) :
        column === "D" ? Number(report.byMethod.QR.amount) :
        column === "E" ? Number(report.summary.grossRevenue) :
        column === "F" ? Number(report.summary.refundedAmount) :
        column === "G" ? Number(report.summary.netRevenue) :
        report.summary.paidOrderCount,
    };
  }

  styleWorkbook(summary, 5, [2, 3, 4, 5, 6]);
  styleWorkbook(journal, 3, [8, 9, 10]);
  styleWorkbook(daily, 3, [3, 4, 5, 6, 7]);
  journal.getColumn(2).numFmt = "dd/mm/yyyy";
  daily.getColumn(2).numFmt = "dd/mm/yyyy";
  summary.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  journal.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  daily.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function styleWorkbook(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  moneyColumns: number[],
): void {
  sheet.getCell("A1").font = { name: "Arial", size: 15, bold: true, color: { argb: "FF173F35" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;
  sheet.getRow(headerRow).eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173F35" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF173F35" } } };
  });
  sheet.getRow(headerRow).height = 34;
  sheet.eachRow((row, rowNumber) => {
    row.font = rowNumber === headerRow ? row.font : { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle", wrapText: true };
  });
  moneyColumns.forEach((column) => {
    sheet.getColumn(column).numFmt = "#,##0;[Red](#,##0);-";
    sheet.getColumn(column).alignment = { horizontal: "right", vertical: "middle" };
  });
  sheet.columns.forEach((column, index) => {
    const widths = [7, 14, 18, 46, 16, 10, 10, 18, 18, 18];
    column.width = widths[index] ?? 16;
  });
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
}

async function createTaxDeclarationDocx(
  template: Buffer,
  report: Awaited<ReturnType<RevenueReportService["getRevenueReport"]>>,
  tax: TaxDeclarationInput,
  revenueExpenseMethod: boolean,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Tax declaration template is missing word/document.xml");
  let xml = await documentFile.async("string");
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date(report.range.to));
  const from = formatDate(report.range.from);
  const to = formatDate(report.range.to);

  xml = replaceParagraph(xml, "[01]", revenueExpenseMethod
    ? `[01] Kỳ tính thuế: Năm ${year} Từ ${from} đến ${to}`
    : `[01] Kỳ tính thuế: Năm ${year}`);
  xml = replaceParagraph(xml, "[02]", "[02] Lần đầu ☒                        [03] Bổ sung lần thứ:");

  if (revenueExpenseMethod) {
    xml = replaceParagraph(xml, "[04]", `[04] Ngành nghề có tỷ lệ doanh thu cao nhất: ${tax.activityName}`);
    xml = replaceParagraph(xml, "[05]", "[05] Tỷ lệ (%): 100 %");
    xml = replaceParagraph(xml, "[06]", `[06] Tên người nộp thuế: ${tax.taxpayerName}`);
    xml = replaceParagraph(xml, "[07]", `[07] Mã số thuế: ${tax.taxCode}`);
    xml = fillTaxRevenueExpenseRows(xml, report.summary.netRevenue, tax);
  } else {
    xml = replaceParagraph(xml, "[04]", `[04] Tên người nộp thuế: ${tax.taxpayerName}`);
    xml = replaceParagraph(xml, "[05]", `[05] Mã số thuế: ${tax.taxCode}`);
    xml = fillTaxRevenueRows(xml, report.summary.netRevenue, tax);
    xml = setTableRowLabel(xml, "1.1", `- Doanh thu từ hoạt động ${tax.activityName}`);
    xml = setTableRowValue(xml, "1.1", formatMoney(report.summary.netRevenue));
  }

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function fillTaxRevenueRows(xml: string, revenue: bigint, tax: TaxDeclarationInput): string {
  const payable = percentOf(revenue, tax.taxRatePercent);
  const afterRelief = maxBigInt(0n, payable - BigInt(tax.taxRelief));
  const difference = afterRelief - BigInt(tax.provisionalTaxPaid);
  const remaining = difference - BigInt(tax.priorOverpayment);
  const values: Record<string, bigint> = {
    "[11]": revenue,
    "[12]": payable,
    "[13]": BigInt(tax.taxRelief),
    "[14]": afterRelief,
    "[15]": BigInt(tax.priorOverpayment),
    "[16]": BigInt(tax.provisionalTaxPaid),
    "[17]": difference,
    "[18]": remaining,
  };
  return fillMoneyRows(xml, values);
}

function fillTaxRevenueExpenseRows(xml: string, revenue: bigint, tax: TaxDeclarationInput): string {
  const a1 = revenue - BigInt(tax.deductibleExpenses);
  const b1 = BigInt(tax.adjustmentsIncrease);
  const b8 = BigInt(tax.adjustmentsDecrease);
  const b13 = a1 + b1 - b8;
  const c1 = b13;
  const c2 = BigInt(tax.exemptIncome);
  const c3 = BigInt(tax.carriedLoss);
  const c4 = maxBigInt(0n, c1 - c2 - c3);
  const c5 = BigInt(tax.scienceFund);
  const c6 = maxBigInt(0n, c4 - c5);
  const c9 = percentOf(c6, tax.taxRatePercent);
  const c10 = BigInt(tax.taxRelief);
  const c17 = maxBigInt(0n, c9 - c10);
  const g1 = BigInt(tax.priorOverpayment);
  const g2 = BigInt(tax.provisionalTaxPaid);
  const values: Record<string, bigint | number> = {
    A1: a1,
    B1: b1,
    B7: b1,
    B8: b8,
    B12: b8,
    B13: b13,
    B14: b13,
    B15: 0n,
    C1: c1,
    C2: c2,
    C3: c3,
    C3a: c3,
    C3b: 0n,
    C4: c4,
    C5: c5,
    C6: c6,
    C7: c6,
    C7a: tax.taxRatePercent,
    C8: 0n,
    C8a: 0,
    C9: c9,
    C10: c10,
    C11: 0n,
    C12: c10,
    C13: 0n,
    C14: 0n,
    C15: 0n,
    C16: 0n,
    C17: c17,
    D1: 0n,
    D2: 0n,
    D3: 0n,
    D4: 0n,
    D5: 0n,
    D6: 0n,
    D7: 0n,
    D8: 0n,
    E: c17,
    E1: c17,
    E2: 0n,
    E3: 0n,
    E4: 0n,
    E5: 0n,
    E6: 0n,
    G: g1 + g2,
    G1: g1,
    G2: g2,
    G3: 0n,
    G4: 0n,
    G5: 0n,
    H: c17 - g2,
    H1: c17 - g2,
    H2: 0n,
    H3: 0n,
    I: c17 - g1 - g2,
    "I1=E1+E5-G1-G2": c17 - g1 - g2,
    "I2=E2-G3-G4-G5": 0n,
  };
  return fillMoneyRows(xml, values);
}

function fillMoneyRows(xml: string, values: Record<string, bigint | number>): string {
  return xml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (row) => {
    const cells = [...row.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);
    if (cells.length < 4) return row;
    const code = cellText(cells[2]);
    if (!(code in values)) return row;
    const value = values[code];
    const display = typeof value === "number" ? formatPercent(value) : formatMoney(value);
    const updated = setCellText(cells[3], display);
    return row.replace(cells[3], updated);
  });
}

function setTableRowLabel(xml: string, stt: string, label: string): string {
  return xml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (row) => {
    const cells = [...row.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);
    if (cells.length < 4 || cellText(cells[0]) !== stt) return row;
    return row.replace(cells[1], setCellText(cells[1], label));
  });
}

function setTableRowValue(xml: string, stt: string, value: string): string {
  return xml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (row) => {
    const cells = [...row.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);
    if (cells.length < 4 || cellText(cells[0]) !== stt) return row;
    return row.replace(cells[3], setCellText(cells[3], value));
  });
}

function replaceParagraph(xml: string, prefix: string, value: string): string {
  let replaced = false;
  return xml.replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced || !cellText(paragraph).startsWith(prefix)) return paragraph;
    replaced = true;
    return setTextNodes(paragraph, value);
  });
}

function setCellText(cell: string, value: string): string {
  if (/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/.test(cell)) return setTextNodes(cell, value);
  return cell.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
}

function setTextNodes(fragment: string, value: string): string {
  let first = true;
  return fragment.replace(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/g, (node) => {
    const text = first ? escapeXml(value) : "";
    first = false;
    const open = node.match(/^<w:t(?: [^>]*)?>/)?.[0] ?? "<w:t>";
    return `${open}${text}</w:t>`;
  });
}

function cellText(fragment: string): string {
  return [...fragment.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function formatMoney(value: bigint): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function percentOf(value: bigint, percent: number): bigint {
  const basisPoints = BigInt(Math.round(percent * 100));
  return (value * basisPoints + 5_000n) / 10_000n;
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
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

function localDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(value);
}

function defaultTemplateDirectory(): string {
  const candidates = [
    path.resolve(__dirname, "../../../../../../docs"),
    path.resolve(__dirname, "../../../../../docs"),
    path.resolve(process.cwd(), "../../docs"),
    path.resolve(process.cwd(), "docs"),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, "2._03.TNDN_2507200143.docx")))
    ?? candidates[0];
}
