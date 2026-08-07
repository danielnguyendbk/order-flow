import { NextFunction, Request, Response } from "express";
import { RevenueReportService } from "./revenue.service";
import { parseRevenueQuery } from "./revenue.validation";

export class RevenueReportController {
  constructor(private readonly revenueReportService: RevenueReportService) {}

  public getRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseRevenueQuery(req.query);
      const report = await this.revenueReportService.getRevenueReport(query);
      res.status(200).json({ data: report });
    } catch (err) {
      next(err);
    }
  };
}
