import createHttpError from "http-errors";
import { AdminOrderRepository } from "./admin.repository";
import { OrderService } from "../orders/order.service";
import {
  Order,
  OrderFilters,
  OrderStatusDomain,
  FulfillmentStatus,
  PaymentStatus,
  PaginatedResult,
} from "../orders/order.types";

/**
 * Service for admin-level order management.
 */
export class AdminService {
  constructor(
    private readonly adminRepository: AdminOrderRepository,
    private readonly orderService:    OrderService
  ) {}

  public async getAllOrders(filters: OrderFilters = {}): Promise<PaginatedResult<Order>> {
    return this.adminRepository.findAll(filters);
  }

  public async getOrderById(orderId: string): Promise<Order> {
    const order = await this.adminRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);
    return order;
  }

  /**
   * Force-overrides either the fulfillment or payment status.
   *
   * @param domain   - "FULFILLMENT" or "PAYMENT"
   * @param newStatus - Target status value.
   * @param adminId   - The admin user ID.
   * @param reason    - Override reason for the history log.
   */
  public async overrideStatus(
    orderId:   string,
    domain:    OrderStatusDomain,
    newStatus: FulfillmentStatus | PaymentStatus,
    adminId:   string,
    reason?:   string
  ): Promise<Order> {
    return this.orderService.overrideStatus(orderId, domain, newStatus, adminId, reason);
  }
}
