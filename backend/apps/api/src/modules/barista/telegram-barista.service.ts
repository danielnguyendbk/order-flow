import { Prisma, PrismaClient } from "@prisma/client";

import { TelegramOrderError } from "../orders/telegram-order.service";
import { recordOrderNotification } from "../notifications/notification-outbox.service";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export interface TelegramBaristaOrderItemDto {
  id: string;
  name: string;
  quantity: number;
  note?: string | null;
}

export interface TelegramBaristaOrderDto {
  id: string;
  code: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  assignedBaristaId?: string | null;
  createdAt: string;
  items: TelegramBaristaOrderItemDto[];
}

export interface TelegramBaristaHistoryDto {
  id: string;
  statusDomain: string;
  oldStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  createdAt: string;
}

export interface TelegramBaristaServiceContract {
  listQueue(): Promise<TelegramBaristaOrderDto[]>;
  listMine(baristaId: string): Promise<TelegramBaristaOrderDto[]>;
  getOrder(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto>;
  getHistory(baristaId: string, orderId: string): Promise<TelegramBaristaHistoryDto[]>;
  claim(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto>;
  markReady(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto>;
}

function toOrderDto(order: OrderWithItems): TelegramBaristaOrderDto {
  return {
    id: order.id,
    code: order.orderCode,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalAmount: Number(order.totalAmount),
    assignedBaristaId: order.assignedBaristaId,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.itemName,
      quantity: item.quantity,
      note: item.note,
    })),
  };
}

export class TelegramBaristaService implements TelegramBaristaServiceContract {
  public constructor(private readonly database: PrismaClient = new PrismaClient()) {}

  public async listQueue(): Promise<TelegramBaristaOrderDto[]> {
    const orders = await this.database.order.findMany({
      where: {
        paymentStatus: "PAID",
        fulfillmentStatus: "QUEUED",
        assignedBaristaId: null,
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    return orders.map(toOrderDto);
  }

  public async listMine(baristaId: string): Promise<TelegramBaristaOrderDto[]> {
    const orders = await this.database.order.findMany({
      where: { assignedBaristaId: baristaId },
      include: { items: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return orders.map(toOrderDto);
  }

  public async getOrder(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto> {
    const order = await this.findOrder(this.database, orderId);
    if (!this.canView(order, baristaId)) {
      throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Order belongs to another barista");
    }
    return toOrderDto(order);
  }

  public async getHistory(baristaId: string, orderId: string): Promise<TelegramBaristaHistoryDto[]> {
    const order = await this.findOrder(this.database, orderId);
    if (order.assignedBaristaId !== baristaId) {
      throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Only the assigned barista can view order history");
    }
    const history = await this.database.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return history.map((entry) => ({
      id: entry.id,
      statusDomain: entry.statusDomain,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  public async claim(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto> {
    const order = await this.serializable(async (tx) => {
      const current = await this.findOrder(tx, orderId);
      if (current.assignedBaristaId === baristaId && current.fulfillmentStatus === "PREPARING") return current;
      if (current.assignedBaristaId && current.assignedBaristaId !== baristaId) {
        throw new TelegramOrderError(409, "ORDER_ALREADY_CLAIMED", "Order has already been claimed");
      }
      if (current.paymentStatus !== "PAID" || current.fulfillmentStatus !== "QUEUED") {
        throw new TelegramOrderError(409, "ORDER_NOT_CLAIMABLE", "Order must be paid and queued before it can be claimed");
      }

      const changed = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: "PAID", fulfillmentStatus: "QUEUED", assignedBaristaId: null },
        data: { fulfillmentStatus: "PREPARING", assignedBaristaId: baristaId },
      });
      if (changed.count !== 1) {
        throw new TelegramOrderError(409, "ORDER_ALREADY_CLAIMED", "Order has already been claimed");
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusDomain: "FULFILLMENT",
          oldStatus: "QUEUED",
          newStatus: "PREPARING",
          changedByUserId: baristaId,
        },
      });
      return this.findOrder(tx, orderId);
    });
    return toOrderDto(order);
  }

  public async markReady(baristaId: string, orderId: string): Promise<TelegramBaristaOrderDto> {
    const order = await this.serializable(async (tx) => {
      const current = await this.findOrder(tx, orderId);
      if (current.assignedBaristaId !== baristaId) {
        throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Only the assigned barista can mark the order ready");
      }
      if (current.fulfillmentStatus === "READY") return current;
      if (current.fulfillmentStatus !== "PREPARING") {
        throw new TelegramOrderError(409, "ORDER_NOT_PREPARING", "Order must be preparing before it can be marked ready");
      }

      const changed = await tx.order.updateMany({
        where: { id: orderId, assignedBaristaId: baristaId, fulfillmentStatus: "PREPARING" },
        data: { fulfillmentStatus: "READY" },
      });
      if (changed.count !== 1) {
        throw new TelegramOrderError(409, "ORDER_STATE_CHANGED", "Order state changed while processing the request");
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusDomain: "FULFILLMENT",
          oldStatus: "PREPARING",
          newStatus: "READY",
          changedByUserId: baristaId,
        },
      });
      await recordOrderNotification(tx, "ORDER_READY", orderId);
      return this.findOrder(tx, orderId);
    });
    return toOrderDto(order);
  }

  private canView(order: OrderWithItems, baristaId: string): boolean {
    return order.assignedBaristaId === baristaId
      || (order.assignedBaristaId === null && order.paymentStatus === "PAID" && order.fulfillmentStatus === "QUEUED");
  }

  private async findOrder(database: PrismaClient | Prisma.TransactionClient, orderId: string): Promise<OrderWithItems> {
    const order = await database.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new TelegramOrderError(404, "ORDER_NOT_FOUND", "Order does not exist");
    return order;
  }

  private async serializable<T>(operation: (database: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.database.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
      }
    }
    throw new Error("Serializable transaction retry exhausted");
  }
}
