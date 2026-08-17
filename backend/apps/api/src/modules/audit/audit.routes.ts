import { Router } from "express";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

export function createAuditRouter(): Router {
  const service = new AuditService();
  const controller = new AuditController(service);
  const router = Router();

  router.get("/audit-logs", controller.listAuditLogs);

  return router;
}

