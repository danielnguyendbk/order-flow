import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminOrderRepository } from "./admin.repository";
import { OrderService } from "../orders/order.service";
import { OrderRepository } from "../orders/order.repository";
import { HistoryRepository } from "../order-status-history/history.repository";
import { PaymentRepository } from "../payments/payment.repository";
import { createReconciliationRouter } from "../reconciliations/reconciliation.routes";
import { createAuditRouter } from "../audit/audit.routes";
import { createRefundRouter } from "../refunds/refund.routes";
import { createRevenueReportRouter } from "../reports/revenue.routes";

/**
 * Bootstraps the Admin router.
 *
 * Mounted at: /api/v1/admin
 *
 *   GET  /orders                          listOrders
 *   GET  /orders/:orderId                  getOrder
 *   POST /orders/:orderId/override-status  overrideStatus
 */
export function createAdminRouter(): Router {
  const adminRepository   = new AdminOrderRepository();
  const orderRepository   = new OrderRepository();
  const historyRepository = new HistoryRepository();
  const paymentRepository = new PaymentRepository();
  const orderService      = new OrderService(orderRepository, historyRepository, paymentRepository);
  const adminService      = new AdminService(adminRepository, orderService);
  const controller        = new AdminController(adminService);

  const router = Router();

  router.get("/orders",                           controller.listOrders);
  router.get("/orders/:orderId",                  controller.getOrder);
  router.post("/orders/:orderId/override-status", controller.overrideStatus);
  router.use("/", createRefundRouter());
  router.use("/", createAuditRouter());
  router.use("/", createRevenueReportRouter());
  router.use("/", createReconciliationRouter());

  return router;
}
