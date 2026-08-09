import { Router, type NextFunction, type Response } from "express";

import { createRequireBarista, getTelegramEmployee } from "../auth/telegram-request.middleware";
import { PrismaTelegramEmployeeRepository } from "../auth/telegram-session.repository";
import type { TelegramEmployeeRepository } from "../auth/telegram-session.types";
import { TelegramOrderError } from "../orders/telegram-order.service";
import {
  TelegramBaristaService,
  type TelegramBaristaServiceContract,
} from "./telegram-barista.service";

export interface TelegramBaristaRouterOptions {
  internalSecret: string;
  employeeRepository?: TelegramEmployeeRepository;
  baristaService?: TelegramBaristaServiceContract;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof TelegramOrderError) {
    res.status(error.statusCode).json({ code: error.code, message: error.message });
    return;
  }
  next(error);
}

export function createTelegramBaristaRouter(options: TelegramBaristaRouterOptions): Router {
  const router = Router();
  const employeeRepository = options.employeeRepository ?? new PrismaTelegramEmployeeRepository();
  const requireBarista = createRequireBarista({
    ...options,
    employeeRepository,
  });
  const service = options.baristaService ?? new TelegramBaristaService();

  router.get("/barista/queue", requireBarista, async (_req, res, next) => {
    try { res.json(await service.listQueue()); } catch (error) { handleError(error, res, next); }
  });

  router.get("/barista/orders", requireBarista, async (_req, res, next) => {
    try { res.json(await service.listMine(getTelegramEmployee(res).id)); } catch (error) { handleError(error, res, next); }
  });

  router.get("/barista/orders/:orderId", requireBarista, async (req, res, next) => {
    try { res.json(await service.getOrder(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.get("/barista/orders/:orderId/history", requireBarista, async (req, res, next) => {
    try { res.json(await service.getHistory(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/claim", requireBarista, async (req, res, next) => {
    try { res.json(await service.claim(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/ready", requireBarista, async (req, res, next) => {
    try { res.json(await service.markReady(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  return router;
}
