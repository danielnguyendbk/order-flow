import { Router } from "express";
import type { AuthServicePort } from "../auth/auth.service.js";
import { requireAdminAccess } from "../auth/auth.middleware.js";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminOrderRepository } from "./admin.repository";
import { OrderService } from "../orders/order.service";
import { OrderRepository } from "../orders/order.repository";
import { HistoryRepository } from "../order-status-history/history.repository";
import { PaymentRepository } from "../payments/payment.repository";

export interface AdminRouterDependencies {
  adminRepository?: AdminOrderRepository;
  orderService?: OrderService;
}

/**
 * Bootstraps the Admin router.
 *
 * Mounted at: /api/v1/admin
 *
 *   GET  /orders                          listOrders
 *   GET  /orders/:orderId                  getOrder
 *   POST /orders/:orderId/override-status  overrideStatus
 */
export function createAdminRouter(
  authService: AuthServicePort,
  dependencies: AdminRouterDependencies = {},
): Router {
  const adminRepository = dependencies.adminRepository ?? new AdminOrderRepository();
  const orderService = dependencies.orderService ?? (() => {
    const orderRepository   = new OrderRepository();
    const historyRepository = new HistoryRepository();
    const paymentRepository = new PaymentRepository();
    return new OrderService(orderRepository, historyRepository, paymentRepository);
  })();
  const adminService = new AdminService(adminRepository, orderService);
  const controller = new AdminController(adminService);

  const router = Router();

  router.use(requireAdminAccess(authService));

  router.get("/orders",                           controller.listOrders);
  router.get("/orders/:orderId",                  controller.getOrder);
  router.post("/orders/:orderId/override-status", controller.overrideStatus);

  return router;
}
