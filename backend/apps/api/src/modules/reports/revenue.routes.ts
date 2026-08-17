import { Router } from "express";
import { RevenueReportController } from "./revenue.controller";
import { RevenueReportService } from "./revenue.service";
import { RevenueExportService } from "./revenue-export.service";

export function createRevenueReportRouter(): Router {
  const service = new RevenueReportService();
  const controller = new RevenueReportController(service, new RevenueExportService());
  const router = Router();

  router.get("/reports/revenue", controller.getRevenueReport);
  router.post("/reports/revenue/export", controller.exportRevenueReport);

  return router;
}
