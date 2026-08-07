import { createServer, type Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../api/src/app";
import type { TelegramEmployeeRepository } from "../../../api/src/modules/auth/telegram-session.types";
import type {
  TelegramOrderDto,
  TelegramOrderServiceContract,
  TelegramQrPaymentDto,
} from "../../../api/src/modules/orders/telegram-order.service";
import { BackendClient } from "../api/backend-client.js";
import { draftCallbackData } from "../callbacks/callback-data.js";
import type { BotSession } from "../types.js";
import {
  handleDraftCallback,
  handleDraftText,
  startDraftOrder,
  type DraftOrderCallbackContext,
  type DraftOrderContext,
} from "./draft-order.handler.js";
import { showMyOrders, showOrderStatus, type OrderStatusContext } from "./order-status.handler.js";

const telegramUserId = 880_028;
const employeeId = "00000000-0000-0000-0000-000000000028";
const internalSecret = "service-order-e2e-secret";

function cloneOrder(order: TelegramOrderDto): TelegramOrderDto {
  return { ...order, items: order.items.map((item) => ({ ...item })) };
}

class InMemoryOrderService implements TelegramOrderServiceContract {
  public readonly orders = new Map<string, TelegramOrderDto>();
  private sequence = 0;

  async listCategories() { return [{ id: "tea", name: "Trà" }]; }
  async listItems(categoryId: string) { return [{ id: "peach-tea", categoryId, name: "Trà đào", price: 30_000, isActive: true }]; }
  async createDraft() {
    this.sequence += 1;
    const order: TelegramOrderDto = {
      id: `order-${this.sequence}`,
      code: `ORD-00${this.sequence}`,
      paymentMethod: null,
      paymentStatus: "UNPAID",
      fulfillmentStatus: "PENDING_PAYMENT",
      totalAmount: 0,
      items: [],
    };
    this.orders.set(order.id, order);
    return cloneOrder(order);
  }
  async listMine() { return [...this.orders.values()].map(cloneOrder); }
  async getOrder(_employeeId: string, orderId: string) { return cloneOrder(this.required(orderId)); }
  async addItem(_employeeId: string, orderId: string, input: { menuItemId: string; quantity: number; note?: string }) {
    const order = this.required(orderId);
    order.items.push({ id: `line-${order.items.length + 1}`, menuItemId: input.menuItemId, name: "Trà đào", quantity: input.quantity, unitPrice: 30_000, note: input.note });
    order.totalAmount = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return cloneOrder(order);
  }
  async updateItem(_employeeId: string, orderId: string, itemId: string, input: { quantity?: number; note?: string }) {
    const order = this.required(orderId);
    const item = order.items.find((candidate) => candidate.id === itemId)!;
    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.note !== undefined) item.note = input.note;
    order.totalAmount = order.items.reduce((sum, candidate) => sum + candidate.quantity * candidate.unitPrice, 0);
    return cloneOrder(order);
  }
  async deleteItem(_employeeId: string, orderId: string, itemId: string) {
    const order = this.required(orderId);
    order.items = order.items.filter((item) => item.id !== itemId);
    order.totalAmount = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return cloneOrder(order);
  }
  async cancelDraft(_employeeId: string, orderId: string) {
    const order = this.required(orderId);
    order.fulfillmentStatus = "CANCELLED";
    return cloneOrder(order);
  }
  async confirmCash(_employeeId: string, orderId: string) {
    const order = this.required(orderId);
    order.paymentMethod = "CASH";
    order.paymentStatus = "PAID";
    order.fulfillmentStatus = "QUEUED";
    return cloneOrder(order);
  }
  async createQr(_employeeId: string, orderId: string): Promise<TelegramQrPaymentDto> {
    const order = this.required(orderId);
    order.paymentMethod = "QR";
    order.paymentStatus = "PENDING";
    return { order: cloneOrder(order), paymentCode: `PAY${order.code.replaceAll("-", "")}`, amount: order.totalAmount, qrImageUrl: "https://vietqr.app/img?amount=60000" };
  }
  async deliver(_employeeId: string, orderId: string) {
    const order = this.required(orderId);
    order.fulfillmentStatus = "DELIVERED";
    return cloneOrder(order);
  }
  markQrPaid(orderId: string): void {
    const order = this.required(orderId);
    order.paymentStatus = "PAID";
    order.fulfillmentStatus = "QUEUED";
  }
  private required(orderId: string): TelegramOrderDto {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("Order not found");
    return order;
  }
}

let server: Server | undefined;
let client: BackendClient;
let orderService: InMemoryOrderService;

beforeEach(async () => {
  orderService = new InMemoryOrderService();
  const employees: TelegramEmployeeRepository = {
    findByTelegramUserId: async (id) => id === telegramUserId ? {
      id: employeeId,
      fullName: "Khoa",
      telegramUserId: BigInt(id),
      role: "SERVICE_STAFF",
      status: "ACTIVE",
    } : null,
  };
  const app = createApp({
    telegramSession: { internalSecret, employeeRepository: employees },
    telegramOrders: { employeeRepository: employees, orderService },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("E2E server did not expose a port");
  client = new BackendClient(`http://127.0.0.1:${address.port}/api/v1`, internalSecret);
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

function draftContext(session: BotSession, replies: string[]): DraftOrderContext {
  return { from: { id: telegramUserId }, session, reply: async (message) => void replies.push(message) };
}

function callbackContext(data: string, session: BotSession, replies: string[]): DraftOrderCallbackContext {
  const match = /^draft:(category|item):(.+)$/.exec(data);
  const simple = data === "draft:pay:cash" ? "payCash" : data === "draft:pay:qr" ? "payQr" : undefined;
  const callbackData = match
    ? draftCallbackData(session.draftOrder!.callbackRevision, match[1] === "category" ? "category" : "item", match[2])
    : simple
      ? draftCallbackData(session.draftOrder!.callbackRevision, simple)
      : data;
  return {
    ...draftContext(session, replies),
    callbackId: `callback-${data}`,
    callbackData,
    answerCallback: async () => undefined,
  };
}

async function buildReviewedOrder(session: BotSession, replies: string[]): Promise<string> {
  await startDraftOrder(draftContext(session, replies), client);
  const orderId = session.draftOrder!.orderId;
  await handleDraftCallback(callbackContext("draft:category:tea", session, replies), client);
  await handleDraftCallback(callbackContext("draft:item:peach-tea", session, replies), client);
  await handleDraftText({ ...draftContext(session, replies), text: "2" }, client);
  await handleDraftText({ ...draftContext(session, replies), text: "Ít đá" }, client);
  expect(session.draftOrder?.step).toBe("REVIEW");
  return orderId;
}

describe("Complete service-staff Telegram order flow over HTTP", () => {
  it("creates items, confirms CASH, then lists and tracks the paid order", async () => {
    const session: BotSession = {};
    const replies: string[] = [];
    const orderId = await buildReviewedOrder(session, replies);

    await handleDraftCallback(callbackContext("draft:pay:cash", session, replies), client);
    expect(session.draftOrder).toBeUndefined();
    expect(orderService.orders.get(orderId)).toMatchObject({ totalAmount: 60_000, paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED" });

    const tracking: OrderStatusContext = draftContext(session, replies);
    await showMyOrders(tracking, client);
    await showOrderStatus(tracking, client, orderId);
    expect(replies.at(-1)).toContain("PAID");
    expect(replies.at(-1)).toContain("QUEUED");
  });

  it("creates QR and refreshes status after payment confirmation", async () => {
    const session: BotSession = {};
    const replies: string[] = [];
    const orderId = await buildReviewedOrder(session, replies);

    await handleDraftCallback(callbackContext("draft:pay:qr", session, replies), client);
    expect(replies.at(-1)).toContain("PENDING");
    expect(replies.at(-1)).toContain("PAYORD001");

    orderService.markQrPaid(orderId);
    await showOrderStatus(draftContext(session, replies), client, orderId);
    expect(replies.at(-1)).toContain("PAID");
    expect(replies.at(-1)).toContain("QUEUED");
  });
});
