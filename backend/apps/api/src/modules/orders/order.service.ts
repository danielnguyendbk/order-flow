import createHttpError from "http-errors";
import { PrismaClient } from "@prisma/client";
import { OrderRepository } from "./order.repository";
import { HistoryRepository } from "../order-status-history/history.repository";
import { PaymentRepository } from "../payments/payment.repository";
import {
  Order,
  CreateOrderInput,
  AddItemInput,
  UpdateItemInput,
  FulfillmentStatus,
  PaymentStatus,
  OrderStatusDomain,
  OrderFilters,
  PaginatedResult,
} from "./order.types";
import {
  isValidFulfillmentTransition,
  isOrderEditable,
  isFulfillmentTerminal,
  isValidPaymentTransition,
} from "./state-machine";

const prisma = new PrismaClient();

function isRecordNotFoundError(error: unknown): boolean {
  return (error as { code?: string }).code === "P2025";
}

/**
 * Orchestrates all business logic for the Order entity.
 * Coordinates OrderRepository, PaymentRepository, and HistoryRepository.
 */
export class OrderService {
  constructor(
    private readonly orderRepository:   OrderRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly paymentRepository: PaymentRepository
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Customer endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Creates a new order (fulfillmentStatus=PENDING_PAYMENT, paymentStatus=UNPAID)
   * and immediately creates a corresponding Payment record.
   *
   * Only active/available menu items in active categories can be ordered.
   * Prices and names are snapshotted directly from the database (client does not dictate price).
   *
   * Body: { createdByUserId, paymentMethod?, customerNote?, items[] }
   */
  public async createOrder(input: CreateOrderInput): Promise<Order> {
    if (!input.items || input.items.length === 0) {
      throw createHttpError(400, "An order must have at least one item");
    }

    const enrichedItems: Array<{ menuItemId: string; itemName: string; unitPrice: bigint; quantity: number; note?: string }> = [];

    // 1. Resolve menu items and verify availability/active category status
    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw createHttpError(400, "Quantity must be greater than 0");
      }

      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
        include: { category: true }
      });

      if (!menuItem) {
        throw createHttpError(404, `Menu item with ID ${item.menuItemId} not found`);
      }

      if (!menuItem.isAvailable) {
        throw createHttpError(400, `Menu item "${menuItem.name}" is not currently available`);
      }

      if (!menuItem.category.isActive) {
        throw createHttpError(400, `Menu category "${menuItem.category.name}" is not currently active`);
      }

      enrichedItems.push({
        menuItemId: item.menuItemId,
        itemName:   menuItem.name,
        unitPrice:  menuItem.price, // Trust backend price, not client
        quantity:   item.quantity,
        note:       item.note
      });
    }

    // 2. Persist the order + items (DB defaults set fulfillmentStatus=PENDING_PAYMENT, paymentStatus=UNPAID)
    const order = await this.orderRepository.create(
      input.createdByUserId,
      input.paymentMethod,
      input.customerNote,
      enrichedItems
    );

    // 3. Create the associated payment record
    await this.paymentRepository.createForOrder(
      order.id,
      order.orderCode,
      order.totalAmount
    );

    // 4. Log initial fulfillment transition
    await this.historyRepository.create({
      orderId:      order.id,
      statusDomain: OrderStatusDomain.FULFILLMENT,
      oldStatus:    null,
      newStatus:    FulfillmentStatus.PENDING_PAYMENT,
      changedByUserId: input.createdByUserId,
    });

    return order;
  }

  /**
   * Retrieves a paginated, filtered list of orders.
   */
  public async getOrders(filters: OrderFilters = {}): Promise<PaginatedResult<Order>> {
    return this.orderRepository.findAll(filters);
  }

  /**
   * Retrieves a single order by ID.
   * @throws 404 if not found.
   */
  public async getOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw createHttpError(404, `Order ${id} not found`);
    return order;
  }

  /**
   * Adds an item to an order that is still in PENDING_PAYMENT / UNPAID status.
   * Resolves price/name from the MenuItem database record.
   *
   * @throws 404 order/item not found.
   * @throws 409 if order is not editable (already paid or processing).
   */
  public async addItem(
    orderId:       string,
    item:          AddItemInput,
    requesterId?:  string
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    // Lock edit check: Only edit items when UNPAID and PENDING_PAYMENT
    if (order.paymentStatus !== PaymentStatus.UNPAID || order.fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
      throw createHttpError(
        409,
        `Cannot add items. Order must be UNPAID and PENDING_PAYMENT. Current: payment=${order.paymentStatus}, fulfillment=${order.fulfillmentStatus}.`
      );
    }

    if (item.quantity <= 0) {
      throw createHttpError(400, "Quantity must be greater than 0");
    }

    // Resolve menu item
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId },
      include: { category: true }
    });

    if (!menuItem) {
      throw createHttpError(404, `Menu item with ID ${item.menuItemId} not found`);
    }

    if (!menuItem.isAvailable) {
      throw createHttpError(400, `Menu item "${menuItem.name}" is not currently available`);
    }

    if (!menuItem.category.isActive) {
      throw createHttpError(400, `Menu category "${menuItem.category.name}" is not currently active`);
    }

    const enriched = {
      menuItemId: item.menuItemId,
      itemName:   menuItem.name,
      unitPrice:  menuItem.price, // Trust backend price, not client
      quantity:   item.quantity,
      note:       item.note
    };

    try {
      return await this.orderRepository.addItem(orderId, enriched);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw createHttpError(409, "Order is no longer editable");
      }
      throw error;
    }
  }

  /**
   * Updates a specific item (quantity or note) on a PENDING_PAYMENT / UNPAID order.
   *
   * @throws 404 if order or item not found.
   * @throws 409 if order is not editable.
   */
  public async updateItem(
    orderId:      string,
    itemId:       string,
    input:        UpdateItemInput,
    requesterId?: string
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    // Lock edit check: Only edit items when UNPAID and PENDING_PAYMENT
    if (order.paymentStatus !== PaymentStatus.UNPAID || order.fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
      throw createHttpError(
        409,
        `Cannot update items. Order must be UNPAID and PENDING_PAYMENT. Current: payment=${order.paymentStatus}, fulfillment=${order.fulfillmentStatus}.`
      );
    }

    const item = await this.orderRepository.findItemById(orderId, itemId);
    if (!item) throw createHttpError(404, `Item ${itemId} not found in order ${orderId}`);

    if (input.quantity !== undefined && input.quantity <= 0) {
      throw createHttpError(400, "Quantity must be greater than 0");
    }

    try {
      return await this.orderRepository.updateItem(orderId, itemId, input);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw createHttpError(409, "Order is no longer editable");
      }
      throw error;
    }
  }

  /**
   * Deletes an item from a PENDING_PAYMENT / UNPAID order.
   * Prevents deleting the last item.
   *
   * @throws 400 if the item is the last one.
   * @throws 404 if order or item not found.
   * @throws 409 if order is not editable.
   */
  public async deleteItem(
    orderId:      string,
    itemId:       string,
    requesterId?: string
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    // Lock edit check: Only edit items when UNPAID and PENDING_PAYMENT
    if (order.paymentStatus !== PaymentStatus.UNPAID || order.fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
      throw createHttpError(
        409,
        `Cannot remove items. Order must be UNPAID and PENDING_PAYMENT. Current: payment=${order.paymentStatus}, fulfillment=${order.fulfillmentStatus}.`
      );
    }

    const item = await this.orderRepository.findItemById(orderId, itemId);
    if (!item) throw createHttpError(404, `Item ${itemId} not found in order ${orderId}`);

    if (order.items.length === 1) {
      throw createHttpError(400, "Cannot remove the last item from an order");
    }

    try {
      return await this.orderRepository.deleteItem(orderId, itemId);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw createHttpError(409, "Order is no longer editable");
      }
      throw error;
    }
  }

  /**
   * Cancels an order.
   * - Allowed for: PENDING_PAYMENT, QUEUED, PREPARING (not READY, DELIVERED, CANCELLED)
   * - `reason` is REQUIRED (enforced by SQL constraint orders_cancellation_reason_chk)
   *
   * @throws 400 if reason is missing.
   * @throws 404 if order not found.
   * @throws 409 if transition is not allowed.
   */
  public async cancelOrder(
    orderId:      string,
    reason:       string,
    requesterId?: string
  ): Promise<Order> {
    if (!reason || reason.trim() === "") {
      throw createHttpError(400, "cancellation reason is required");
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    const current = order.fulfillmentStatus;

    if (!isValidFulfillmentTransition(current, FulfillmentStatus.CANCELLED)) {
      throw createHttpError(
        409,
        `Cannot cancel an order in ${current} status`
      );
    }

    const updated = await this.orderRepository.updateFulfillmentStatus(
      orderId,
      FulfillmentStatus.CANCELLED,
      { cancellationReason: reason.trim() }
    );

    await this.historyRepository.create({
      orderId,
      statusDomain:    OrderStatusDomain.FULFILLMENT,
      oldStatus:       current,
      newStatus:       FulfillmentStatus.CANCELLED,
      changedByUserId: requesterId,
      reason,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // Barista endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Barista claims a QUEUED order → PREPARING.
   *
   * Guards:
   * 1. Order must be QUEUED and paymentStatus must be PAID.
   * 2. Operation must be atomic (prevents double-assignment race conditions).
   *
   * @throws 404 if order not found.
   * @throws 409 if order cannot be claimed (already assigned, unpaid, or not queued).
   */
  public async claimOrder(orderId: string, baristaId: string): Promise<Order> {
    try {
      const updated = await prisma.order.update({
        where: {
          id:                orderId,
          fulfillmentStatus: FulfillmentStatus.QUEUED as any,
          assignedBaristaId: null,
          paymentStatus:     PaymentStatus.PAID as any,
        },
        data: {
          fulfillmentStatus: FulfillmentStatus.PREPARING as any,
          assignedBaristaId: baristaId,
        },
        include: { items: true },
      });

      await this.historyRepository.create({
        orderId,
        statusDomain:    OrderStatusDomain.FULFILLMENT,
        oldStatus:       FulfillmentStatus.QUEUED,
        newStatus:       FulfillmentStatus.PREPARING,
        changedByUserId: baristaId,
      });

      return updated as unknown as Order;
    } catch (error) {
      throw createHttpError(
        409,
        "Order cannot be claimed. It may already be claimed, not paid, or not in QUEUED status."
      );
    }
  }

  /**
   * Barista marks a PREPARING order as READY for pickup.
   *
   * Guards:
   * 1. Only the assigned barista OR a manager (OWNER / SERVICE_STAFF) can trigger this.
   *
   * @throws 403 if caller is not the assignee or manager.
   * @throws 409 if transition is invalid.
   */
  public async markReady(orderId: string, requesterUserId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    // Fetch requester user to determine role
    const user = await prisma.user.findUnique({
      where: { id: requesterUserId }
    });

    if (!user) {
      throw createHttpError(404, `User ${requesterUserId} not found`);
    }

    const isAssignee = order.assignedBaristaId === requesterUserId;
    const isManager  = user.role === "OWNER" || user.role === "SERVICE_STAFF";

    if (!isAssignee && !isManager) {
      throw createHttpError(403, "Only the assigned barista or a manager can mark this order as READY");
    }

    const current = order.fulfillmentStatus;

    if (!isValidFulfillmentTransition(current, FulfillmentStatus.READY)) {
      throw createHttpError(
        409,
        `Cannot mark order as READY from ${current} status`
      );
    }

    const updated = await this.orderRepository.updateFulfillmentStatus(
      orderId,
      FulfillmentStatus.READY
    );

    await this.historyRepository.create({
      orderId,
      statusDomain:    OrderStatusDomain.FULFILLMENT,
      oldStatus:       current,
      newStatus:       FulfillmentStatus.READY,
      changedByUserId: requesterUserId,
    });

    return updated;
  }

  /**
   * Delivers a READY order → DELIVERED.
   *
   * Guards:
   * 1. Only the creator of the order OR a manager (OWNER / SERVICE_STAFF) can trigger this.
   * 2. Order must be in READY status.
   *
   * @throws 403 if caller is not the creator or manager.
   * @throws 409 if order is not READY.
   */
  public async deliverOrder(orderId: string, requesterUserId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    // Fetch requester user to determine role
    const user = await prisma.user.findUnique({
      where: { id: requesterUserId }
    });

    if (!user) {
      throw createHttpError(404, `User ${requesterUserId} not found`);
    }

    const isCreator = order.createdByUserId === requesterUserId;
    const isManager = user.role === "OWNER" || user.role === "SERVICE_STAFF";

    if (!isCreator && !isManager) {
      throw createHttpError(403, "Only the creator of the order or a manager can mark it as DELIVERED");
    }

    if (order.fulfillmentStatus !== FulfillmentStatus.READY) {
      throw createHttpError(
        409,
        `Cannot deliver an order in ${order.fulfillmentStatus} status. Order must be READY.`
      );
    }

    const updated = await this.orderRepository.updateFulfillmentStatus(
      orderId,
      FulfillmentStatus.DELIVERED
    );

    await this.historyRepository.create({
      orderId,
      statusDomain:    OrderStatusDomain.FULFILLMENT,
      oldStatus:       FulfillmentStatus.READY,
      newStatus:       FulfillmentStatus.DELIVERED,
      changedByUserId: requesterUserId,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // Admin endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Admin override: force-sets either `fulfillmentStatus` or `paymentStatus`
   * on a non-terminal order, bypassing normal transition rules.
   *
   * Blocked if:
   * - Overriding fulfillment on a DELIVERED or CANCELLED order.
   *
   * @param domain   - "FULFILLMENT" or "PAYMENT"
   * @param newStatus - The target status value.
   * @param adminId   - The admin's user ID.
   * @param reason    - Reason for the override.
   */
  public async overrideStatus(
    orderId:   string,
    domain:    OrderStatusDomain,
    newStatus: FulfillmentStatus | PaymentStatus,
    adminId:   string,
    reason?:   string
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw createHttpError(404, `Order ${orderId} not found`);

    let updated: Order;

    if (domain === OrderStatusDomain.FULFILLMENT) {
      const current = order.fulfillmentStatus;

      if (isFulfillmentTerminal(current)) {
        throw createHttpError(
          409,
          `Cannot override fulfillment status of an order in ${current} status (terminal).`
        );
      }

      const opts =
        newStatus === FulfillmentStatus.CANCELLED
          ? { cancellationReason: reason ?? "Admin override" }
          : undefined;

      updated = await this.orderRepository.updateFulfillmentStatus(
        orderId,
        newStatus as FulfillmentStatus,
        opts
      );

      await this.historyRepository.create({
        orderId,
        statusDomain:    OrderStatusDomain.FULFILLMENT,
        oldStatus:       current,
        newStatus:       newStatus as string,
        changedByUserId: adminId,
        reason:          reason ?? "Admin status override",
      });
    } else {
      // PAYMENT domain override
      const current = order.paymentStatus;

      const opts =
        newStatus === PaymentStatus.PAID ? { paidAt: new Date() } : undefined;

      updated = await this.orderRepository.updatePaymentStatus(
        orderId,
        newStatus as PaymentStatus,
        opts
      );

      await this.historyRepository.create({
        orderId,
        statusDomain:    OrderStatusDomain.PAYMENT,
        oldStatus:       current,
        newStatus:       newStatus as string,
        changedByUserId: adminId,
        reason:          reason ?? "Admin payment override",
      });
    }

    return updated;
  }
}
