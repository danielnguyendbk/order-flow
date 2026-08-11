import { describe, expect, it, vi } from "vitest";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { BaristaOrder, DraftOrder } from "../api/order-types.js";
import type { EmployeeSession } from "../types.js";
import {
  formatBaristaOrder,
  handleBaristaCallback,
  showActiveBaristaOrders,
  showBaristaQueue,
  type BaristaCallbackContext,
  type BaristaOrderContext,
} from "./barista-order.handler.js";

const employee: EmployeeSession = {
  employeeId: "barista-1",
  telegramUserId: 202,
  displayName: "Khoa",
  role: "BARISTA",
};

const baristaOrder: BaristaOrder = {
  id: "order-1",
  code: "ORD-001",
  paymentStatus: "PAID",
  fulfillmentStatus: "QUEUED",
  totalAmount: 30_000,
  assignedBaristaId: null,
  createdAt: "2026-08-05T00:00:00.000Z",
  items: [{ id: "line-1", name: "Trà đào", quantity: 1 }],
};

const draft: DraftOrder = {
  id: "draft-1",
  code: "DRAFT-1",
  paymentStatus: "UNPAID",
  fulfillmentStatus: "PENDING_PAYMENT",
  totalAmount: 0,
  items: [],
};

function api(overrides: Partial<BackendApi> = {}): BackendApi {
  return {
    createTelegramSession: vi.fn().mockResolvedValue(employee),
    createDraftOrder: vi.fn().mockResolvedValue(draft),
    getMenuCategories: vi.fn().mockResolvedValue([]),
    getMenuItems: vi.fn().mockResolvedValue([]),
    addDraftOrderItem: vi.fn().mockResolvedValue(draft),
    updateDraftOrderItem: vi.fn().mockResolvedValue(draft),
    deleteDraftOrderItem: vi.fn().mockResolvedValue(draft),
    getDraftOrder: vi.fn().mockResolvedValue(draft),
    cancelDraftOrder: vi.fn().mockResolvedValue(undefined),
    listMyOrders: vi.fn().mockResolvedValue([]),
    confirmCashPayment: vi.fn().mockResolvedValue(draft),
    createQrPayment: vi.fn(),
    deliverOrder: vi.fn().mockResolvedValue(draft),
    listBaristaQueue: vi.fn().mockResolvedValue([baristaOrder]),
    listBaristaOrders: vi.fn().mockResolvedValue([]),
    getBaristaOrder: vi.fn().mockResolvedValue(baristaOrder),
    getBaristaOrderHistory: vi.fn().mockResolvedValue([{ id: "history-1", statusDomain: "FULFILLMENT", oldStatus: "QUEUED", newStatus: "PREPARING", createdAt: "2026-08-05T00:01:00.000Z" }]),
    claimBaristaOrder: vi.fn().mockResolvedValue({ ...baristaOrder, assignedBaristaId: "barista-1", fulfillmentStatus: "PREPARING" }),
    markBaristaOrderReady: vi.fn().mockResolvedValue({ ...baristaOrder, assignedBaristaId: "barista-1", fulfillmentStatus: "READY" }),
    ...overrides,
  };
}

function context(data = "barista:queue") {
  const replies: Array<{ message: string; extra?: object }> = [];
  const answers: string[] = [];
  const ctx: BaristaCallbackContext & { replies: typeof replies; answers: string[] } = {
    from: { id: employee.telegramUserId },
    session: { employee },
    callbackData: data,
    replies,
    answers,
    reply: async (message, extra) => void replies.push({ message, extra }),
    answerCallback: async (message) => void answers.push(message ?? ""),
  };
  return ctx;
}

function callbackData(extra?: object): string[] {
  const keyboard = extra as { reply_markup?: { inline_keyboard?: Array<Array<{ callback_data?: string }>> } } | undefined;
  return keyboard?.reply_markup?.inline_keyboard?.flat().map((button) => button.callback_data ?? "") ?? [];
}

describe("Barista Telegram order flow", () => {
  it("lists the authenticated barista queue", async () => {
    const backend = api();
    const ctx = context();
    await showBaristaQueue(ctx as BaristaOrderContext, backend);
    expect(backend.listBaristaQueue).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.replies[0].message).toContain("HÀNG ĐỢI · 1 đơn");
    expect(ctx.replies[0].message).toContain("1× Trà đào");
    expect(callbackData(ctx.replies[0].extra)).toContain("barista:view:order-1");
  });

  it("opens detail and claims using the authenticated Telegram identity", async () => {
    const backend = api();
    const detail = context("barista:view:order-1");
    await handleBaristaCallback(detail, backend);
    expect(backend.getBaristaOrder).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(detail.replies[0].message).toContain("ORD-001");
    expect(callbackData(detail.replies[0].extra)).toContain("barista:claim:order-1");

    const claim = context("barista:claim:order-1");
    await handleBaristaCallback(claim, backend);
    expect(backend.claimBaristaOrder).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(claim.replies[0].message).toContain("Trạng thái: Đang pha");
    expect(callbackData(claim.replies[0].extra)).toContain("barista:ready:order-1");
  });

  it("marks only the assigned order READY and shows status history", async () => {
    const backend = api();
    const ready = context("barista:ready:order-1");
    await handleBaristaCallback(ready, backend);
    expect(backend.markBaristaOrderReady).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(ready.replies[0].message).toContain("Trạng thái: Sẵn sàng giao");
    expect(callbackData(ready.replies[0].extra)).toContain("barista:history:order-1");
    expect(callbackData(ready.replies[0].extra)).not.toContain("barista:ready:order-1");

    const history = context("barista:history:order-1");
    await handleBaristaCallback(history, backend);
    expect(backend.getBaristaOrderHistory).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(history.replies[0].message).toContain("Pha chế: Chờ pha → Đang pha chế");
  });

  it("shows only PREPARING orders in the active-work shortcut", async () => {
    const preparing = { ...baristaOrder, id: "order-preparing", code: "ORD-P", fulfillmentStatus: "PREPARING", assignedBaristaId: "barista-1" };
    const ready = { ...baristaOrder, id: "order-ready", code: "ORD-R", fulfillmentStatus: "READY", assignedBaristaId: "barista-1" };
    const backend = api({ listBaristaOrders: vi.fn().mockResolvedValue([preparing, ready]) });
    const ctx = context();

    await showActiveBaristaOrders(ctx, backend);

    expect(ctx.replies[0].message).toContain("ĐANG PHA · 1 đơn");
    expect(ctx.replies[0].message).toContain("ORD-P");
    expect(ctx.replies[0].message).not.toContain("ORD-R");
  });

  it("makes item notes prominent in the preparation ticket", () => {
    const ticket = formatBaristaOrder({
      ...baristaOrder,
      items: [{ ...baristaOrder.items[0], quantity: 2, note: "Không đường" }],
    });

    expect(ticket).toContain("2 × Trà đào");
    expect(ticket).toContain("LƯU Ý: Không đường");
  });

  it("handles a stale claim conflict without pretending it succeeded", async () => {
    const backend = api({
      claimBaristaOrder: vi.fn().mockRejectedValue(new BackendApiError("Already claimed", 409, "ORDER_ALREADY_CLAIMED")),
    });
    const ctx = context("barista:claim:order-1");
    await handleBaristaCallback(ctx, backend);
    expect(ctx.replies[0].message).toContain("Trạng thái đơn vừa thay đổi");
  });

  it("re-authenticates and blocks the next callback after deactivation", async () => {
    const backend = api({
      createTelegramSession: vi.fn().mockRejectedValue(new BackendApiError("Inactive", 403, "EMPLOYEE_INACTIVE")),
    });
    const ctx = context("barista:claim:order-1");
    await handleBaristaCallback(ctx, backend);
    expect(ctx.session.employee).toBeUndefined();
    expect(backend.claimBaristaOrder).not.toHaveBeenCalled();
  });
});
