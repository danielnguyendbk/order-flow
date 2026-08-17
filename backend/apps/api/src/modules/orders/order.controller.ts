import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service";
import {
  validateCreateOrder,
  validateAddItem,
  validateUpdateItem,
  validateCancelOrder,
} from "./order.validation";
import { OrderFilters, FulfillmentStatus, PaymentStatus } from "./order.types";

/**
 * Handles all HTTP requests for /api/v1/orders endpoints.
 * Delegates all business logic to OrderService.
 */
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // POST /api/v1/orders. The creator is always the authenticated user.
  public createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateCreateOrder(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }

      if (!req.auth?.userId) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      const order = await this.orderService.createOrder({
        ...req.body,
        createdByUserId: req.auth.userId,
      });
      res.status(201).json(order);
    } catch (err) { next(err); }
  };

  // GET /api/v1/orders
  // Query: fulfillmentStatus, paymentStatus, createdByUserId, assignedBaristaId, page, limit
  public listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: OrderFilters = {
        fulfillmentStatus: req.query.fulfillmentStatus as FulfillmentStatus | undefined,
        paymentStatus:     req.query.paymentStatus     as PaymentStatus     | undefined,
        createdByUserId:   req.query.createdByUserId   as string | undefined,
        assignedBaristaId: req.query.assignedBaristaId as string | undefined,
        page:  req.query.page  ? parseInt(req.query.page  as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };
      if (req.auth?.role === "SERVICE_STAFF") {
        filters.createdByUserId = req.auth.userId;
      }
      const result = await this.orderService.getOrders(filters);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  // GET /api/v1/orders/:orderId
  public getOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.getOrderById(String(req.params.orderId));
      if (req.auth?.role === "SERVICE_STAFF" && order.createdByUserId !== req.auth.userId) {
        res.status(403).json({ message: "Service staff can only view their own orders" });
        return;
      }
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/items
  // Body: { menuItemId, quantity, note? }
  public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateAddItem(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }
      if (!req.auth?.userId) { res.status(401).json({ message: "Authenticated user is required" }); return; }

      const order = await this.orderService.addItem(
        String(req.params.orderId),
        req.body,
        req.auth.userId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // PATCH /api/v1/orders/:orderId/items/:itemId
  // Body: { quantity?, note? }
  public updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateUpdateItem(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }
      if (!req.auth?.userId) { res.status(401).json({ message: "Authenticated user is required" }); return; }

      const order = await this.orderService.updateItem(
        String(req.params.orderId),
        String(req.params.itemId),
        req.body,
        req.auth.userId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // DELETE /api/v1/orders/:orderId/items/:itemId
  public deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth?.userId) { res.status(401).json({ message: "Authenticated user is required" }); return; }
      const order = await this.orderService.deleteItem(
        String(req.params.orderId),
        String(req.params.itemId),
        req.auth.userId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/cancel
  // Body: { reason (required) }
  public cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateCancelOrder(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }
      if (!req.auth?.userId) { res.status(401).json({ message: "Authenticated user is required" }); return; }

      const order = await this.orderService.cancelOrder(
        String(req.params.orderId),
        req.body.reason,
        req.auth.userId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/claim
  // Body: { baristaId }
  public claimOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body?.baristaId) { res.status(400).json({ message: "baristaId is required" }); return; }

      const order = await this.orderService.claimOrder(
        String(req.params.orderId),
        req.body.baristaId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/ready
  // The acting user is derived from the authenticated admin session.
  public markReady = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.auth?.userId;
      if (!requesterId) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      const order = await this.orderService.markReady(
        String(req.params.orderId),
        requesterId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/deliver
  // The acting user is derived from the authenticated admin session.
  public deliverOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.auth?.userId;
      if (!requesterId) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      const order = await this.orderService.deliverOrder(
        String(req.params.orderId),
        requesterId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };
}
