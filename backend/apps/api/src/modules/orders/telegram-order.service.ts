import { Prisma, PrismaClient } from "@prisma/client";

import { generateOrderCode, generatePaymentCode } from "./order-code";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export interface TelegramMenuCategoryDto {
  id: string;
  name: string;
}

export interface TelegramMenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface TelegramOrderItemDto {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
}

export interface TelegramOrderDto {
  id: string;
  code: string;
  paymentMethod?: "CASH" | "QR" | null;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "UNDERPAID" | "OVERPAID" | "REVIEW";
  fulfillmentStatus: "PENDING_PAYMENT" | "QUEUED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  items: TelegramOrderItemDto[];
}

export interface TelegramQrPaymentDto {
  order: TelegramOrderDto;
  paymentCode: string;
  amount: number;
  qrImageUrl: string;
}

export interface TelegramOrderServiceContract {
  listCategories(): Promise<TelegramMenuCategoryDto[]>;
  listItems(categoryId: string): Promise<TelegramMenuItemDto[]>;
  createDraft(employeeId: string): Promise<TelegramOrderDto>;
  listMine(employeeId: string): Promise<TelegramOrderDto[]>;
  getOrder(employeeId: string, orderId: string): Promise<TelegramOrderDto>;
  addItem(employeeId: string, orderId: string, input: { menuItemId: string; quantity: number; note?: string }): Promise<TelegramOrderDto>;
  updateItem(employeeId: string, orderId: string, itemId: string, input: { quantity?: number; note?: string }): Promise<TelegramOrderDto>;
  deleteItem(employeeId: string, orderId: string, itemId: string): Promise<TelegramOrderDto>;
  cancelDraft(employeeId: string, orderId: string): Promise<TelegramOrderDto>;
  confirmCash(employeeId: string, orderId: string): Promise<TelegramOrderDto>;
  createQr(employeeId: string, orderId: string): Promise<TelegramQrPaymentDto>;
  deliver(employeeId: string, orderId: string): Promise<TelegramOrderDto>;
}

export class TelegramOrderError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TelegramOrderError";
  }
}

export interface TelegramQrConfig {
  accountNumber: string;
  bankName: string;
  accountHolder?: string;
  imageBaseUrl?: string;
}

function toOrderDto(order: OrderWithItems): TelegramOrderDto {
  return {
    id: order.id,
    code: order.orderCode,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      note: item.note,
    })),
  };
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new TelegramOrderError(400, "QUANTITY_INVALID", "Quantity must be an integer from 1 to 99");
  }
}

function assertNote(note: string | undefined): void {
  if (note !== undefined && note.length > 250) {
    throw new TelegramOrderError(400, "NOTE_TOO_LONG", "Note must be at most 250 characters");
  }
}

export class TelegramOrderService implements TelegramOrderServiceContract {
  public constructor(
    private readonly database: PrismaClient = new PrismaClient(),
    private readonly qrConfig: TelegramQrConfig = {
      accountNumber: process.env.SEPAY_BANK_ACCOUNT ?? "",
      bankName: process.env.SEPAY_BANK_NAME ?? "",
      accountHolder: process.env.SEPAY_ACCOUNT_HOLDER,
      imageBaseUrl: process.env.SEPAY_QR_IMAGE_BASE_URL,
    },
  ) {}

  public async listCategories(): Promise<TelegramMenuCategoryDto[]> {
    return this.database.menuCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  }

  public async listItems(categoryId: string): Promise<TelegramMenuItemDto[]> {
    const category = await this.database.menuCategory.findFirst({
      where: { id: categoryId, isActive: true },
      include: { items: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] } },
    });
    if (!category) throw new TelegramOrderError(404, "CATEGORY_NOT_FOUND", "Menu category is not active or does not exist");
    return category.items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      price: Number(item.price),
      isActive: item.isAvailable,
    }));
  }

  public async createDraft(employeeId: string): Promise<TelegramOrderDto> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const order = await this.serializable(async (tx) => {
          const existing = await tx.order.findFirst({
            where: {
              createdByUserId: employeeId,
              paymentStatus: "UNPAID",
              fulfillmentStatus: "PENDING_PAYMENT",
            },
            include: { items: true },
            orderBy: { updatedAt: "desc" },
          });
          if (existing) return existing;

          const created = await tx.order.create({
            data: { orderCode: generateOrderCode(), createdByUserId: employeeId },
            include: { items: true },
          });
          await tx.orderStatusHistory.create({
            data: { orderId: created.id, statusDomain: "FULFILLMENT", newStatus: "PENDING_PAYMENT", changedByUserId: employeeId },
          });
          return created;
        });
        return toOrderDto(order);
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 2) throw error;
      }
    }
    throw new Error("Unable to generate a unique order code");
  }

  public async listMine(employeeId: string): Promise<TelegramOrderDto[]> {
    const orders = await this.database.order.findMany({
      where: { createdByUserId: employeeId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return orders.map(toOrderDto);
  }

  public async getOrder(employeeId: string, orderId: string): Promise<TelegramOrderDto> {
    return toOrderDto(await this.ownedOrder(this.database, employeeId, orderId));
  }

  public async addItem(employeeId: string, orderId: string, input: { menuItemId: string; quantity: number; note?: string }): Promise<TelegramOrderDto> {
    assertQuantity(input.quantity);
    assertNote(input.note);
    return this.database.$transaction(async (tx) => {
      await this.ownedEditableOrder(tx, employeeId, orderId);
      const menuItem = await tx.menuItem.findFirst({
        where: { id: input.menuItemId, isAvailable: true, category: { isActive: true } },
      });
      if (!menuItem) throw new TelegramOrderError(409, "MENU_ITEM_UNAVAILABLE", "Menu item is no longer available");
      await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          unitPrice: menuItem.price,
          quantity: input.quantity,
          note: input.note,
        },
      });
      return this.recalculate(tx, orderId);
    }).then(toOrderDto);
  }

  public async updateItem(employeeId: string, orderId: string, itemId: string, input: { quantity?: number; note?: string }): Promise<TelegramOrderDto> {
    if (input.quantity === undefined && input.note === undefined) throw new TelegramOrderError(400, "ITEM_UPDATE_EMPTY", "Quantity or note is required");
    if (input.quantity !== undefined) assertQuantity(input.quantity);
    assertNote(input.note);
    return this.database.$transaction(async (tx) => {
      await this.ownedEditableOrder(tx, employeeId, orderId);
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new TelegramOrderError(404, "ORDER_ITEM_NOT_FOUND", "Order item does not exist");
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
        },
      });
      return this.recalculate(tx, orderId);
    }).then(toOrderDto);
  }

  public async deleteItem(employeeId: string, orderId: string, itemId: string): Promise<TelegramOrderDto> {
    return this.database.$transaction(async (tx) => {
      await this.ownedEditableOrder(tx, employeeId, orderId);
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new TelegramOrderError(404, "ORDER_ITEM_NOT_FOUND", "Order item does not exist");
      await tx.orderItem.delete({ where: { id: itemId } });
      return this.recalculate(tx, orderId);
    }).then(toOrderDto);
  }

  public async cancelDraft(employeeId: string, orderId: string): Promise<TelegramOrderDto> {
    const order = await this.database.$transaction(async (tx) => {
      const current = await this.ownedOrder(tx, employeeId, orderId);
      if (current.fulfillmentStatus === "CANCELLED") return current;
      if (current.paymentStatus === "PAID") throw new TelegramOrderError(409, "ORDER_NOT_EDITABLE", "A paid order cannot be cancelled as a draft");
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: "CANCELLED", cancellationReason: "Cancelled by service staff" },
        include: { items: true },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, statusDomain: "FULFILLMENT", oldStatus: current.fulfillmentStatus, newStatus: "CANCELLED", changedByUserId: employeeId },
      });
      return updated;
    });
    return toOrderDto(order);
  }

  public async confirmCash(employeeId: string, orderId: string): Promise<TelegramOrderDto> {
    const order = await this.serializable(async (tx) => {
      const current = await this.ownedOrder(tx, employeeId, orderId);
      if (current.paymentMethod === "CASH" && current.paymentStatus === "PAID") return current;
      this.assertReadyForPayment(current, "CASH");
      const paidAt = new Date();
      await tx.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          expectedAmount: current.totalAmount,
          receivedAmount: current.totalAmount,
          cashConfirmedByUserId: employeeId,
          confirmedAt: paidAt,
        },
        update: {
          expectedAmount: current.totalAmount,
          receivedAmount: current.totalAmount,
          cashConfirmedByUserId: employeeId,
          confirmedAt: paidAt,
        },
      });
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED", paidAt },
        include: { items: true },
      });
      await tx.orderStatusHistory.createMany({ data: [
        { orderId, statusDomain: "PAYMENT", oldStatus: current.paymentStatus, newStatus: "PAID", changedByUserId: employeeId },
        { orderId, statusDomain: "FULFILLMENT", oldStatus: current.fulfillmentStatus, newStatus: "QUEUED", changedByUserId: employeeId },
      ] });
      return updated;
    });
    return toOrderDto(order);
  }

  public async createQr(employeeId: string, orderId: string): Promise<TelegramQrPaymentDto> {
    if (!this.qrConfig.accountNumber || !this.qrConfig.bankName) {
      throw new TelegramOrderError(503, "QR_CONFIG_MISSING", "SePay bank account configuration is missing");
    }
    const result = await this.serializable(async (tx) => {
      const current = await this.ownedOrder(tx, employeeId, orderId);
      if (current.paymentMethod === "QR" && ["PENDING", "PAID"].includes(current.paymentStatus)) {
        const existing = await tx.payment.findUnique({ where: { orderId } });
        if (!existing?.paymentCode) throw new TelegramOrderError(409, "PAYMENT_STATE_INVALID", "QR payment record is incomplete");
        return { order: current, paymentCode: existing.paymentCode };
      }
      this.assertReadyForPayment(current, "QR");
      const paymentCode = generatePaymentCode(current.orderCode);
      await tx.payment.upsert({
        where: { orderId },
        create: { orderId, paymentCode, expectedAmount: current.totalAmount },
        update: { paymentCode, expectedAmount: current.totalAmount },
      });
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { paymentMethod: "QR", paymentStatus: "PENDING" },
        include: { items: true },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, statusDomain: "PAYMENT", oldStatus: current.paymentStatus, newStatus: "PENDING", changedByUserId: employeeId },
      });
      return { order: updated, paymentCode };
    });

    const baseUrl = this.qrConfig.imageBaseUrl || "https://vietqr.app/img";
    const qrUrl = new URL(baseUrl);
    qrUrl.searchParams.set("acc", this.qrConfig.accountNumber);
    qrUrl.searchParams.set("bank", this.qrConfig.bankName);
    qrUrl.searchParams.set("amount", String(result.order.totalAmount));
    qrUrl.searchParams.set("des", result.paymentCode);
    qrUrl.searchParams.set("template", "compact");
    if (this.qrConfig.accountHolder) qrUrl.searchParams.set("holder", this.qrConfig.accountHolder);

    return {
      order: toOrderDto(result.order),
      paymentCode: result.paymentCode,
      amount: Number(result.order.totalAmount),
      qrImageUrl: qrUrl.toString(),
    };
  }

  public async deliver(employeeId: string, orderId: string): Promise<TelegramOrderDto> {
    const order = await this.serializable(async (tx) => {
      const current = await this.ownedOrder(tx, employeeId, orderId);
      if (current.fulfillmentStatus === "DELIVERED") return current;
      if (current.fulfillmentStatus !== "READY") {
        throw new TelegramOrderError(409, "ORDER_NOT_READY", "Order must be ready before delivery");
      }
      const changed = await tx.order.updateMany({
        where: { id: orderId, createdByUserId: employeeId, fulfillmentStatus: "READY" },
        data: { fulfillmentStatus: "DELIVERED" },
      });
      if (changed.count !== 1) {
        throw new TelegramOrderError(409, "ORDER_STATE_CHANGED", "Order state changed while processing the request");
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusDomain: "FULFILLMENT",
          oldStatus: "READY",
          newStatus: "DELIVERED",
          changedByUserId: employeeId,
        },
      });
      return this.ownedOrder(tx, employeeId, orderId);
    });
    return toOrderDto(order);
  }

  private async ownedOrder(database: PrismaClient | Prisma.TransactionClient, employeeId: string, orderId: string): Promise<OrderWithItems> {
    const order = await database.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new TelegramOrderError(404, "ORDER_NOT_FOUND", "Order does not exist");
    if (order.createdByUserId !== employeeId) throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Order belongs to another employee");
    return order;
  }

  private async ownedEditableOrder(database: Prisma.TransactionClient, employeeId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ownedOrder(database, employeeId, orderId);
    if (order.paymentStatus !== "UNPAID" || order.fulfillmentStatus !== "PENDING_PAYMENT") {
      throw new TelegramOrderError(409, "ORDER_NOT_EDITABLE", "Order is no longer editable");
    }
    return order;
  }

  private assertReadyForPayment(order: OrderWithItems, requestedMethod: "CASH" | "QR"): void {
    if (order.paymentMethod && order.paymentMethod !== requestedMethod) {
      throw new TelegramOrderError(409, "PAYMENT_METHOD_CONFLICT", "Order already uses another payment method");
    }
    if (order.paymentStatus !== "UNPAID" || order.fulfillmentStatus !== "PENDING_PAYMENT") {
      throw new TelegramOrderError(409, "ORDER_NOT_PAYABLE", "Order is no longer payable");
    }
    if (order.items.length === 0 || order.totalAmount <= 0n) {
      throw new TelegramOrderError(409, "ORDER_EMPTY", "Add at least one item before payment");
    }
  }

  private async recalculate(database: Prisma.TransactionClient, orderId: string): Promise<OrderWithItems> {
    const items = await database.orderItem.findMany({ where: { orderId } });
    const totalAmount = items.reduce((total, item) => total + item.unitPrice * BigInt(item.quantity), 0n);
    return database.order.update({ where: { id: orderId }, data: { totalAmount }, include: { items: true } });
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
