import { PrismaClient } from "@prisma/client";
import { Order, FulfillmentStatus } from "../orders/order.types";

const prisma = new PrismaClient();

/**
 * Service providing barista-specific order views.
 * Uses Prisma directly — read-only queries only.
 */
export class BaristaService {
  /**
   * Returns all QUEUED orders sorted oldest-first.
   * These are paid orders waiting to be claimed by a barista.
   */
  public async getQueue(): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        fulfillmentStatus: FulfillmentStatus.QUEUED as any,
        paymentStatus: "PAID",
      },
      include:  { items: true },
      orderBy:  { createdAt: "asc" },
    });
    return orders as unknown as Order[];
  }

  /**
   * Returns all in-progress orders assigned to a specific barista.
   * Includes PREPARING and READY statuses.
   *
   * @param baristaId - The barista's user ID.
   */
  public async getBaristaOrders(baristaId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: {
        assignedBaristaId: baristaId,
        fulfillmentStatus: {
          in: [FulfillmentStatus.PREPARING as any, FulfillmentStatus.READY as any],
        },
      },
      include:  { items: true },
      orderBy:  { createdAt: "asc" },
    });
    return orders as unknown as Order[];
  }
}
