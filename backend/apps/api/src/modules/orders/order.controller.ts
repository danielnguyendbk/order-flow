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

  // POST /api/v1/orders
  public createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateCreateOrder(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }

      const order = await this.orderService.createOrder(req.body);
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
      const result = await this.orderService.getOrders(filters);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  // GET /api/v1/orders/:orderId
  public getOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.getOrderById(req.params.orderId);
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/items
  // Body: { menuItemId, itemName, unitPrice, quantity, note? }
  public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateAddItem(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }

      const order = await this.orderService.addItem(
        req.params.orderId,
        req.body,
        req.body.requesterId
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

      const order = await this.orderService.updateItem(
        req.params.orderId,
        req.params.itemId,
        req.body
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // DELETE /api/v1/orders/:orderId/items/:itemId
  public deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.deleteItem(
        req.params.orderId,
        req.params.itemId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/cancel
  // Body: { reason (required), requesterId? }
  public cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateCancelOrder(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }

      const order = await this.orderService.cancelOrder(
        req.params.orderId,
        req.body.reason,
        req.body.requesterId
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
        req.params.orderId,
        req.body.baristaId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/ready
  // Body: { requesterId | baristaId | userId }
  public markReady = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.body?.requesterId || req.body?.baristaId || req.body?.userId;
      if (!requesterId) {
        res.status(400).json({ message: "requesterId, baristaId, or userId is required" });
        return;
      }

      const order = await this.orderService.markReady(
        req.params.orderId,
        requesterId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/orders/:orderId/deliver
  // Body: { requesterId | baristaId | userId }
  public deliverOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.body?.requesterId || req.body?.baristaId || req.body?.userId;
      if (!requesterId) {
        res.status(400).json({ message: "requesterId, baristaId, or userId is required" });
        return;
      }

      const order = await this.orderService.deliverOrder(
        req.params.orderId,
        requesterId
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };
}
