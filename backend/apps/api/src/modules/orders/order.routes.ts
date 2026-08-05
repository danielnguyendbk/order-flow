import { Router } from "express";
import { OrderController } from "./order.controller";
import { OrderRepository } from "./order.repository";
import { OrderService } from "./order.service";
import { HistoryRepository } from "../order-status-history/history.repository";
import { PaymentRepository } from "../payments/payment.repository";

/**
 * Creates and wires the Orders router.
 *
 * Mounted at: /api/v1/orders
 *
 *   POST   /                      createOrder
 *   GET    /                      listOrders
 *   GET    /:orderId               getOrder
 *   POST   /:orderId/items         addItem
 *   PATCH  /:orderId/items/:itemId updateItem
 *   DELETE /:orderId/items/:itemId deleteItem
 *   POST   /:orderId/cancel        cancelOrder
 *   POST   /:orderId/claim         claimOrder   (barista)
 *   POST   /:orderId/ready         markReady    (barista)
 *   POST   /:orderId/deliver       deliverOrder (barista)
 */
export function createOrderRouter(): Router {
  const orderRepository   = new OrderRepository();
  const historyRepository = new HistoryRepository();
  const paymentRepository = new PaymentRepository();
  const orderService      = new OrderService(orderRepository, historyRepository, paymentRepository);
  const controller        = new OrderController(orderService);

  const router = Router();

  // Customer routes
  router.post("/",                                controller.createOrder);
  router.get("/",                                 controller.listOrders);
  router.get("/:orderId",                         controller.getOrder);
  router.post("/:orderId/items",                  controller.addItem);
  router.patch("/:orderId/items/:itemId",         controller.updateItem);
  router.delete("/:orderId/items/:itemId",        controller.deleteItem);
  router.post("/:orderId/cancel",                 controller.cancelOrder);

  // Barista routes
  router.post("/:orderId/claim",                  controller.claimOrder);
  router.post("/:orderId/ready",                  controller.markReady);
  router.post("/:orderId/deliver",                controller.deliverOrder);

  return router;
}
