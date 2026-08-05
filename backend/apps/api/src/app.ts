import express, { Application, Request, Response, NextFunction } from "express";
import { createOrderRouter }  from "./modules/orders/order.routes";
import { createBaristaRouter } from "./modules/barista/barista.routes";
import { createAdminRouter }  from "./modules/admin/admin.routes";
import {
  createTelegramSessionRouter,
  type TelegramSessionRouterOptions,
} from "./modules/auth/telegram-session.routes";

// ── BigInt JSON serialization fix ─────────────────────────────
// Prisma returns BigInt for columns declared as bigint.
// JSON.stringify does not support BigInt natively.
// For VND amounts (max ~quadrillions), Number is safe up to 2^53.
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/**
 * Creates and configures the Express application.
 *
 * Route map (/api/v1):
 *
 *   POST   /telegram/session
 *
 *   POST   /orders
 *   GET    /orders
 *   GET    /orders/:orderId
 *   POST   /orders/:orderId/items
 *   PATCH  /orders/:orderId/items/:itemId
 *   DELETE /orders/:orderId/items/:itemId
 *   POST   /orders/:orderId/cancel
 *   POST   /orders/:orderId/claim
 *   POST   /orders/:orderId/ready
 *   POST   /orders/:orderId/deliver
 *
 *   GET    /barista/queue
 *   GET    /barista/orders
 *
 *   GET    /admin/orders
 *   GET    /admin/orders/:orderId
 *   POST   /admin/orders/:orderId/override-status
 */
export interface AppOptions {
  telegramSession?: TelegramSessionRouterOptions;
}

export function createApp(options: AppOptions = {}): Application {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Health check ──────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "order-flow-api" });
  });

  // ── API v1 routes ─────────────────────────────────────────────
  const apiV1 = express.Router();

  apiV1.use("/orders",  createOrderRouter());
  apiV1.use("/barista", createBaristaRouter());
  apiV1.use("/admin",   createAdminRouter());
  apiV1.use(
    "/telegram",
    createTelegramSessionRouter(
      options.telegramSession ?? { internalSecret: process.env.BOT_INTERNAL_SECRET ?? "" },
    ),
  );

  app.use("/api/v1", apiV1);

  // ── 404 handler ───────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
  });

  // ── Global error handler ──────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status  = err.statusCode ?? err.status ?? 500;
    const message = err.message ?? "Internal Server Error";
    res.status(status).json({
      message,
      ...(process.env.NODE_ENV !== "production" && err.stack
        ? { stack: err.stack }
        : {}),
    });
  });

  return app;
}
