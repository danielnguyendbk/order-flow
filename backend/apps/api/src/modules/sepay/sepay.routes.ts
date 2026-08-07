import { Router } from "express";
import { SepayController } from "./sepay.controller";
import { SepayService } from "./sepay.service";

export function createSepayRouter(): Router {
  const service = new SepayService();
  const controller = new SepayController(service);
  const router = Router();

  router.post("/", controller.handleWebhook);

  return router;
}

