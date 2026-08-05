import { PrismaClient } from "@prisma/client";
import { Order, OrderFilters, PaginatedResult } from "../orders/order.types";

const prisma = new PrismaClient();

/**
 * Repository for admin-level unrestricted order access.
 * Includes full history in detailed views.
 */
export class AdminOrderRepository {
  /**
   * Paginated list of all orders with optional filters.
   */
  public async findAll(filters: OrderFilters = {}): Promise<PaginatedResult<Order>> {
    const {
      fulfillmentStatus,
      paymentStatus,
      createdByUserId,
      assignedBaristaId,
      page  = 1,
      limit = 20,
    } = filters;

    const skip  = (page - 1) * limit;
    const where: any = {};

    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
    if (paymentStatus)     where.paymentStatus     = paymentStatus;
    if (createdByUserId)   where.createdByUserId   = createdByUserId;
    if (assignedBaristaId) where.assignedBaristaId = assignedBaristaId;

    const [data, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take:    limit,
        include: { items: true, history: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    return { data: data as unknown as Order[], total, page, limit };
  }

  /**
   * Single order detail with full item list and status history.
   */
  public async findById(id: string): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where:   { id },
      include: { items: true, history: { orderBy: { createdAt: "asc" } } },
    });
    return order as unknown as Order | null;
  }
}
