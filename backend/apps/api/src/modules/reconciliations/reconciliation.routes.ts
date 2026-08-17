import { Router } from "express";
import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";

export function createReconciliationRouter(): Router {
  const service = new ReconciliationService();
  const controller = new ReconciliationController(service);
  const router = Router();

  router.get("/transactions", controller.listTransactions);
  router.get("/transactions/:transactionId", controller.getTransaction);
  router.get("/reconciliations", controller.listReconciliations);
  router.get("/reconciliations/:reconciliationId", controller.getReconciliation);
  router.post("/reconciliations/:reconciliationId/resolve", controller.resolveReconciliation);

  return router;
}

