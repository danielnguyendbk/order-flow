import { Request, Response, NextFunction } from "express";
import { AdminService } from "./admin.service";
import { OrderFilters, FulfillmentStatus, PaymentStatus, OrderStatusDomain } from "../orders/order.types";
import { validateOverrideStatus } from "../orders/order.validation";

/**
 * Handles HTTP requests for admin-level order management.
 *
 *   GET  /api/v1/admin/orders
 *   GET  /api/v1/admin/orders/:orderId
 *   POST /api/v1/admin/orders/:orderId/override-status
 */
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // GET /api/v1/admin/orders
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
      const result = await this.adminService.getAllOrders(filters);
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  // GET /api/v1/admin/orders/:orderId
  public getOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.adminService.getOrderById(String(req.params.orderId));
      res.status(200).json(order);
    } catch (err) { next(err); }
  };

  // POST /api/v1/admin/orders/:orderId/override-status
  // Body: { domain: "FULFILLMENT"|"PAYMENT", status, adminId, reason? }
  public overrideStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const v = validateOverrideStatus(req.body);
      if (!v.isValid) { res.status(400).json({ message: "Validation failed", errors: v.errors }); return; }

      const { domain, status, adminId, reason } = req.body;

      const order = await this.adminService.overrideStatus(
        String(req.params.orderId),
        domain as OrderStatusDomain,
        status as FulfillmentStatus | PaymentStatus,
        adminId,
        reason
      );
      res.status(200).json(order);
    } catch (err) { next(err); }
  };
}
