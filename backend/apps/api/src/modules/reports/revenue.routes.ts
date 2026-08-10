import { Router } from "express";
import { RevenueReportController } from "./revenue.controller";
import { RevenueReportService } from "./revenue.service";

export function createRevenueReportRouter(): Router {
  const service = new RevenueReportService();
  const controller = new RevenueReportController(service);
  const router = Router();

  router.get("/reports/revenue", controller.getRevenueReport);

  return router;
}
