import { PrismaClient } from "@prisma/client";
import { OrderStatusHistory, CreateHistoryInput } from "./history.types";

const prisma = new PrismaClient();

/**
 * Repository for `order_status_history` database operations.
 */
export class HistoryRepository {
  /**
   * Persists a status transition event.
   *
   * @param input - Transition event details including domain, old/new status, actor.
   * @returns The saved history record.
   */
  public async create(input: CreateHistoryInput): Promise<OrderStatusHistory> {
    const record = await prisma.orderStatusHistory.create({
      data: {
        orderId:         input.orderId,
        statusDomain:    input.statusDomain as any,
        oldStatus:       input.oldStatus ?? null,
        newStatus:       input.newStatus,
        changedByUserId: input.changedByUserId ?? null,
        reason:          input.reason ?? null,
      },
    });
    return record as unknown as OrderStatusHistory;
  }

  /**
   * Retrieves all status history entries for a given order, ordered oldest-first.
   *
   * @param orderId - The order ID.
   * @returns Array of history records.
   */
  public async findByOrderId(orderId: string): Promise<OrderStatusHistory[]> {
    const records = await prisma.orderStatusHistory.findMany({
      where:   { orderId },
      orderBy: { createdAt: "asc" },
    });
    return records as unknown as OrderStatusHistory[];
  }
}
