import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../db";
import { createAccountingWorkbook, loadAccountingExportData } from "./accounting-workbook";
import { RevenueReportService, type RevenueReportInput } from "./revenue.service";
import type { RevenueExportInput } from "./revenue-export.validation";

export interface RevenueExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

interface RevenueReportPort {
  getRevenueReport(input: RevenueReportInput): Promise<Awaited<ReturnType<RevenueReportService["getRevenueReport"]>>>;
}

export class RevenueExportService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly revenueReportService: RevenueReportPort = new RevenueReportService(db),
  ) {}

  public async export(input: RevenueExportInput): Promise<RevenueExportResult> {
    const range = { from: input.from, to: input.to };
    const report = await this.revenueReportService.getRevenueReport(range);
    const data = await loadAccountingExportData(this.db, range);
    const period = `${localDateKey(input.from)}_${localDateKey(input.to)}`;

    return {
      buffer: await createAccountingWorkbook(report, data),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `so-doanh-thu-${period}.xlsx`,
    };
  }
}

function localDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
