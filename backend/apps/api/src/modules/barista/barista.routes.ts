import { Router } from "express";
import { BaristaController } from "./barista.controller";
import { BaristaService } from "./barista.service";

/**
 * Bootstraps the Barista router.
 * Wires BaristaService and BaristaController together.
 *
 * Mounted at: /api/v1/barista
 *
 * Routes:
 *   GET /queue   → getQueue
 *   GET /orders  → getBaristaOrders
 */
export function createBaristaRouter(): Router {
  const baristaService = new BaristaService();
  const controller = new BaristaController(baristaService);

  const router = Router();

  router.get("/queue", controller.getQueue);
  router.get("/orders", controller.getBaristaOrders);

  return router;
}
