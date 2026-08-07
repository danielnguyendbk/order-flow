import { createServer, type Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../api/src/app";
import type { TelegramEmployeeRepository } from "../../../api/src/modules/auth/telegram-session.types";
import { TelegramOrderError } from "../../../api/src/modules/orders/telegram-order.service";
import type {
  TelegramBaristaHistoryDto,
  TelegramBaristaOrderDto,
  TelegramBaristaServiceContract,
} from "../../../api/src/modules/barista/telegram-barista.service";
import { BackendClient } from "../api/backend-client.js";
import type { BotSession } from "../types.js";
import { handleBaristaCallback, showBaristaQueue, type BaristaCallbackContext, type BaristaOrderContext } from "./barista-order.handler.js";
import { handleStart } from "./start.handler.js";

const telegramUserId = 880_027;
const baristaId = "00000000-0000-0000-0000-000000000027";
const internalSecret = "barista-e2e-secret";

class InMemoryBaristaService implements TelegramBaristaServiceContract {
  readonly order: TelegramBaristaOrderDto = {
    id: "order-27",
    code: "ORD-027",
    paymentStatus: "PAID",
    fulfillmentStatus: "QUEUED",
    totalAmount: 45_000,
    assignedBaristaId: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    items: [{ id: "line-1", name: "Cà phê sữa", quantity: 1, note: "Ít đá" }],
  };
  readonly history: TelegramBaristaHistoryDto[] = [];

  async listQueue() { return this.order.fulfillmentStatus === "QUEUED" && !this.order.assignedBaristaId ? [this.snapshot()] : []; }
  async listMine(employeeId: string) { return this.order.assignedBaristaId === employeeId ? [this.snapshot()] : []; }
  async getOrder(employeeId: string) {
    if (this.order.assignedBaristaId && this.order.assignedBaristaId !== employeeId) throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Wrong barista");
    return this.snapshot();
  }
  async getHistory(employeeId: string) {
    if (this.order.assignedBaristaId !== employeeId) throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Wrong barista");
    return this.history.map((entry) => ({ ...entry }));
  }
  async claim(employeeId: string) {
    if (this.order.fulfillmentStatus !== "QUEUED" || this.order.assignedBaristaId) throw new TelegramOrderError(409, "ORDER_ALREADY_CLAIMED", "Already claimed");
    this.order.assignedBaristaId = employeeId;
    this.order.fulfillmentStatus = "PREPARING";
    this.history.push({ id: "history-claim", statusDomain: "FULFILLMENT", oldStatus: "QUEUED", newStatus: "PREPARING", createdAt: "2026-08-05T00:01:00.000Z" });
    return this.snapshot();
  }
  async markReady(employeeId: string) {
    if (this.order.assignedBaristaId !== employeeId) throw new TelegramOrderError(403, "ORDER_FORBIDDEN", "Wrong barista");
    if (this.order.fulfillmentStatus !== "PREPARING") throw new TelegramOrderError(409, "ORDER_NOT_PREPARING", "Not preparing");
    this.order.fulfillmentStatus = "READY";
    this.history.push({ id: "history-ready", statusDomain: "FULFILLMENT", oldStatus: "PREPARING", newStatus: "READY", createdAt: "2026-08-05T00:02:00.000Z" });
    return this.snapshot();
  }
  private snapshot(): TelegramBaristaOrderDto { return { ...this.order, items: this.order.items.map((item) => ({ ...item })) }; }
}

let server: Server | undefined;
let client: BackendClient;
let service: InMemoryBaristaService;

beforeEach(async () => {
  service = new InMemoryBaristaService();
  const employees: TelegramEmployeeRepository = {
    findByTelegramUserId: async (id) => id === telegramUserId ? {
      id: baristaId,
      fullName: "Khoa",
      telegramUserId: BigInt(id),
      role: "BARISTA",
      status: "ACTIVE",
    } : null,
  };
  const app = createApp({
    telegramSession: { internalSecret, employeeRepository: employees },
    telegramBarista: { employeeRepository: employees, baristaService: service },
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

function context(data?: string) {
  const replies: string[] = [];
  const session: BotSession = {};
  const base: BaristaOrderContext = { from: { id: telegramUserId }, session, reply: async (message) => void replies.push(message) };
  if (!data) return { base, replies };
  const callback: BaristaCallbackContext = { ...base, callbackData: data, answerCallback: async () => undefined };
  return { base, callback, replies };
}

describe("Complete Barista Telegram flow over HTTP", () => {
  it("runs queue → detail → claim → PREPARING → READY → history", async () => {
    const session: BotSession = {};
    const replies: string[] = [];
    const base: BaristaOrderContext = { from: { id: telegramUserId }, session, reply: async (message) => void replies.push(message) };
    await handleStart(base, client);
    expect(replies.at(-1)).toContain("Khoa");
    await showBaristaQueue(base, client);
    expect(replies.at(-1)).toContain("chờ pha chế");

    const detail = context("barista:view:order-27");
    await handleBaristaCallback(detail.callback!, client);
    expect(detail.replies.at(-1)).toContain("ORD-027");

    const claim = context("barista:claim:order-27");
    await handleBaristaCallback(claim.callback!, client);
    expect(service.order.assignedBaristaId).toBe(baristaId);
    expect(service.order.fulfillmentStatus).toBe("PREPARING");

    const ready = context("barista:ready:order-27");
    await handleBaristaCallback(ready.callback!, client);
    expect(service.order.fulfillmentStatus).toBe("READY");

    const mine = context("barista:orders:mine");
    await handleBaristaCallback(mine.callback!, client);
    expect(mine.replies.at(-1)).toContain("Các đơn pha chế của bạn");

    const history = context("barista:history:order-27");
    await handleBaristaCallback(history.callback!, client);
    expect(history.replies.at(-1)).toContain("QUEUED → PREPARING");
    expect(history.replies.at(-1)).toContain("PREPARING → READY");
  });
});
