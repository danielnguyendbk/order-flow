import { Router, type NextFunction, type Request, type Response } from "express";

import { createRequireServiceStaff, getTelegramEmployee } from "../auth/telegram-request.middleware";
import { PrismaTelegramEmployeeRepository } from "../auth/telegram-session.repository";
import type { TelegramEmployeeRepository } from "../auth/telegram-session.types";
import {
  TelegramOrderError,
  TelegramOrderService,
  type TelegramOrderServiceContract,
  type TelegramQrConfig,
} from "./telegram-order.service";

export interface TelegramOrderRouterOptions {
  internalSecret: string;
  employeeRepository?: TelegramEmployeeRepository;
  orderService?: TelegramOrderServiceContract;
  qrConfig?: TelegramQrConfig;
}

function bodyObject(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
}

function textField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof TelegramOrderError) {
    res.status(error.statusCode).json({ code: error.code, message: error.message });
    return;
  }
  next(error);
}

export function createTelegramOrderRouter(options: TelegramOrderRouterOptions): Router {
  const router = Router();
  const employeeRepository = options.employeeRepository ?? new PrismaTelegramEmployeeRepository();
  const requireServiceStaff = createRequireServiceStaff({ ...options, employeeRepository });
  const requireServiceStaffOrder = createRequireServiceStaff({ ...options, employeeRepository, passThroughWithoutBotHeaders: true });
  const service = options.orderService ?? new TelegramOrderService(undefined, options.qrConfig);

  router.get("/menu/categories", requireServiceStaff, async (_req, res, next) => {
    try { res.json(await service.listCategories()); } catch (error) { handleError(error, res, next); }
  });

  router.get("/menu/items", requireServiceStaff, async (req, res, next) => {
    try {
      const categoryId = textField(req.query.categoryId);
      if (!categoryId) {
        res.status(400).json({ code: "CATEGORY_ID_REQUIRED", message: "categoryId is required" });
        return;
      }
      res.json(await service.listItems(categoryId));
    } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders", requireServiceStaffOrder, async (_req, res, next) => {
    try { res.status(201).json(await service.createDraft(getTelegramEmployee(res).id)); } catch (error) { handleError(error, res, next); }
  });

  router.get("/orders", requireServiceStaffOrder, async (req, res, next) => {
    try {
      if (req.query.mine !== "true") {
        res.status(400).json({ code: "MINE_REQUIRED", message: "mine=true is required" });
        return;
      }
      res.json(await service.listMine(getTelegramEmployee(res).id));
    } catch (error) { handleError(error, res, next); }
  });

  router.get("/orders/:orderId", requireServiceStaffOrder, async (req, res, next) => {
    try { res.json(await service.getOrder(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/items", requireServiceStaffOrder, async (req, res, next) => {
    try {
      const body = bodyObject(req);
      const menuItemId = textField(body.menuItemId);
      if (!menuItemId || typeof body.quantity !== "number" || (body.note !== undefined && typeof body.note !== "string")) {
        res.status(400).json({ code: "ORDER_ITEM_INVALID", message: "menuItemId and numeric quantity are required" });
        return;
      }
      res.json(await service.addItem(getTelegramEmployee(res).id, String(req.params.orderId), {
        menuItemId,
        quantity: body.quantity,
        ...(textField(body.note) !== undefined ? { note: textField(body.note) } : {}),
      }));
    } catch (error) { handleError(error, res, next); }
  });

  router.patch("/orders/:orderId/items/:itemId", requireServiceStaffOrder, async (req, res, next) => {
    try {
      const body = bodyObject(req);
      if ((body.quantity !== undefined && typeof body.quantity !== "number") || (body.note !== undefined && typeof body.note !== "string")) {
        res.status(400).json({ code: "ORDER_ITEM_INVALID", message: "quantity must be numeric and note must be a string" });
        return;
      }
      res.json(await service.updateItem(getTelegramEmployee(res).id, String(req.params.orderId), String(req.params.itemId), {
        ...(typeof body.quantity === "number" ? { quantity: body.quantity } : {}),
        ...(textField(body.note) !== undefined ? { note: textField(body.note) } : {}),
      }));
    } catch (error) { handleError(error, res, next); }
  });

  router.delete("/orders/:orderId/items/:itemId", requireServiceStaffOrder, async (req, res, next) => {
    try { res.json(await service.deleteItem(getTelegramEmployee(res).id, String(req.params.orderId), String(req.params.itemId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/cancel", requireServiceStaffOrder, async (req, res, next) => {
    try { res.json(await service.cancelDraft(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/payments/cash/confirm", requireServiceStaffOrder, async (req, res, next) => {
    try { res.json(await service.confirmCash(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  router.post("/orders/:orderId/payments/qr", requireServiceStaffOrder, async (req, res, next) => {
    try { res.json(await service.createQr(getTelegramEmployee(res).id, String(req.params.orderId))); } catch (error) { handleError(error, res, next); }
  });

  return router;
}
