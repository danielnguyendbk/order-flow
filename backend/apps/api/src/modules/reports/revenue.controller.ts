import { NextFunction, Request, Response } from "express";
import { RevenueReportService } from "./revenue.service";
import { parseRevenueQuery } from "./revenue.validation";
import { RevenueExportService } from "./revenue-export.service";
import { parseRevenueExportInput } from "./revenue-export.validation";

export class RevenueReportController {
  constructor(
    private readonly revenueReportService: RevenueReportService,
    private readonly revenueExportService: RevenueExportService,
  ) {}

  public getRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRevenueQuery(req.query);
      const report = await this.revenueReportService.getRevenueReport(query);
      res.status(200).json({ data: report });
    } catch (err) {
      next(err);
    }
  };

  public exportRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseRevenueExportInput(req.query, req.body);
      const result = await this.revenueExportService.export(input);
      res.setHeader("content-type", result.contentType);
      res.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
      res.status(200).send(result.buffer);
    } catch (err) {
      next(err);
    }
  };
}
