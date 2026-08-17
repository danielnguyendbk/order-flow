import { describe, expect, it, vi } from "vitest";

import type { BackendApi } from "../api/backend-client.js";
import type { BaristaOrder, DraftOrder } from "../api/order-types.js";
import { BARISTA_QUICK_ACTIONS } from "../keyboards/role-menu.js";
import type { EmployeeSession } from "../types.js";
import { handleBaristaQuickAction, type BaristaMenuContext } from "./barista-menu.handler.js";

const employee: EmployeeSession = {
  employeeId: "barista-1",
  telegramUserId: 202,
  displayName: "Khoa",
  role: "BARISTA",
};

const order: BaristaOrder = {
  id: "order-1",
  code: "ORD-001",
  paymentStatus: "PAID",
  fulfillmentStatus: "QUEUED",
  totalAmount: 30_000,
  assignedBaristaId: null,
  createdAt: new Date().toISOString(),
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
    cancelDraftOrder: vi.fn(),
    listMyOrders: vi.fn().mockResolvedValue([]),
    confirmCashPayment: vi.fn().mockResolvedValue(draft),
    createQrPayment: vi.fn(),
    resetQrPayment: vi.fn().mockResolvedValue(draft),
    deliverOrder: vi.fn().mockResolvedValue(draft),
    listBaristaQueue: vi.fn().mockResolvedValue([order]),
    listBaristaOrders: vi.fn().mockResolvedValue([]),
    getBaristaOrder: vi.fn().mockResolvedValue(order),
    getBaristaOrderHistory: vi.fn().mockResolvedValue([]),
    claimBaristaOrder: vi.fn().mockResolvedValue(order),
    markBaristaOrderReady: vi.fn().mockResolvedValue(order),
    ...overrides,
  };
}

function context(): BaristaMenuContext & { replies: Array<[string, object | undefined]> } {
  const replies: Array<[string, object | undefined]> = [];
  return {
    from: { id: employee.telegramUserId },
    session: {},
    replies,
    reply: async (message, extra) => void replies.push([message, extra]),
  };
}

function keyboardLabels(extra: object | undefined): string[] {
  const keyboard = (extra as { reply_markup: { keyboard: Array<Array<{ text: string }>> } }).reply_markup.keyboard;
  return keyboard.flat().map((button) => button.text);
}

describe("barista quick menu", () => {
  it("loads the queue with one authentication request", async () => {
    const ctx = context();
    const backend = api();

    await handleBaristaQuickAction(ctx, backend, "queue");

    expect(backend.createTelegramSession).toHaveBeenCalledTimes(1);
    expect(backend.listBaristaQueue).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.replies.at(-1)?.[0]).toContain("HÀNG ĐỢI");
  });

  it("keeps a role-specific persistent keyboard visible", async () => {
    const ctx = context();

    await handleBaristaQuickAction(ctx, api(), "menu");

    expect(keyboardLabels(ctx.replies.at(-1)?.[1])).toEqual(Object.values(BARISTA_QUICK_ACTIONS));
    expect(ctx.replies.at(-1)?.[1]).toMatchObject({
      reply_markup: { resize_keyboard: true, is_persistent: true, input_field_placeholder: "Chọn thao tác pha chế" },
    });
  });

  it("does not expose barista data to another role", async () => {
    const ctx = context();
    const backend = api({
      createTelegramSession: vi.fn().mockResolvedValue({ ...employee, role: "SERVICE_STAFF" }),
    });

    await handleBaristaQuickAction(ctx, backend, "queue");

    expect(backend.listBaristaQueue).not.toHaveBeenCalled();
    expect(ctx.replies.at(-1)?.[0]).toContain("chỉ dành cho Barista");
  });
});
