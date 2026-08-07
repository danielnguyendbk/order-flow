import { Router } from "express";
import { RefundController } from "./refund.controller";
import { RefundService } from "./refund.service";

export function createRefundRouter(): Router {
  const service = new RefundService();
  const controller = new RefundController(service);
  const router = Router();

  router.post("/orders/:orderId/refund", controller.refundOrder);

  return router;
}

