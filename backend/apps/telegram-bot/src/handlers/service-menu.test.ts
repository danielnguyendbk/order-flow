import { describe, expect, it, vi } from "vitest";

import type { BackendApi } from "../api/backend-client.js";
import type { DraftOrder, MenuItem } from "../api/order-types.js";
import { SERVICE_STAFF_QUICK_ACTIONS } from "../keyboards/role-menu.js";
import type { EmployeeSession } from "../types.js";
import { handleServiceQuickAction, handleUnknownText, type ServiceMenuContext } from "./service-menu.handler.js";

const employee: EmployeeSession = {
  employeeId: "staff-1",
  telegramUserId: 101,
  displayName: "Minh Anh",
  role: "SERVICE_STAFF",
};

const draft: DraftOrder = {
  id: "order-1",
  code: "OF-001",
  paymentStatus: "UNPAID",
  fulfillmentStatus: "PENDING_PAYMENT",
  totalAmount: 0,
  items: [],
};

function api(overrides: Partial<BackendApi> = {}): BackendApi {
  return {
    createTelegramSession: vi.fn().mockResolvedValue(employee),
    createDraftOrder: vi.fn().mockResolvedValue(draft),
    getMenuCategories: vi.fn().mockResolvedValue([{ id: "tea", name: "Trà" }]),
    getMenuItems: vi.fn().mockResolvedValue([]),
    addDraftOrderItem: vi.fn(),
    updateDraftOrderItem: vi.fn(),
    deleteDraftOrderItem: vi.fn(),
    getDraftOrder: vi.fn().mockResolvedValue(draft),
    cancelDraftOrder: vi.fn(),
    listMyOrders: vi.fn().mockResolvedValue([]),
    confirmCashPayment: vi.fn(),
    createQrPayment: vi.fn(),
    deliverOrder: vi.fn(),
    listBaristaQueue: vi.fn(),
    listBaristaOrders: vi.fn(),
    getBaristaOrder: vi.fn(),
    getBaristaOrderHistory: vi.fn(),
    claimBaristaOrder: vi.fn(),
    markBaristaOrderReady: vi.fn(),
    ...overrides,
  };
}

function context(): ServiceMenuContext & { replies: Array<[string, object | undefined]> } {
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

describe("service-staff quick menu", () => {
  it("creates or resumes the same backend draft from the quick order action", async () => {
    const ctx = context();
    const backend = api();

    await handleServiceQuickAction(ctx, backend, "order");

    expect(backend.createDraftOrder).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.session.draftOrder).toMatchObject({ orderId: "order-1", step: "CATEGORY" });
    expect(ctx.replies.at(-1)?.[0]).toBe("Chọn danh mục món:");
  });

  it("lists recent orders without authenticating twice", async () => {
    const ctx = context();
    const backend = api();

    await handleServiceQuickAction(ctx, backend, "orders");

    expect(backend.createTelegramSession).toHaveBeenCalledTimes(1);
    expect(backend.listMyOrders).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.replies.at(-1)?.[0]).toBe("Bạn chưa có đơn nào.");
  });

  it("lists every available menu item grouped by category and keeps the compact keyboard visible", async () => {
    const menu = context();
    const teaItems: MenuItem[] = [
      { id: "peach-tea", categoryId: "tea", name: "Trà đào", price: 30_000, isActive: true },
      { id: "old-tea", categoryId: "tea", name: "Trà ngừng bán", price: 20_000, isActive: false },
    ];
    const coffeeItems: MenuItem[] = [
      { id: "milk-coffee", categoryId: "coffee", name: "Cà phê sữa", price: 25_000, isActive: true },
    ];
    const backend = api({
      getMenuCategories: vi.fn().mockResolvedValue([
        { id: "tea", name: "Trà" },
        { id: "coffee", name: "Cà phê" },
      ]),
      getMenuItems: vi.fn().mockImplementation((_telegramUserId: number, categoryId: string) =>
        Promise.resolve(categoryId === "tea" ? teaItems : coffeeItems)),
    });

    await handleServiceQuickAction(menu, backend, "menu");

    expect(backend.getMenuCategories).toHaveBeenCalledWith(employee.telegramUserId);
    expect(backend.getMenuItems).toHaveBeenCalledWith(employee.telegramUserId, "tea");
    expect(backend.getMenuItems).toHaveBeenCalledWith(employee.telegramUserId, "coffee");
    expect(menu.replies.at(-1)?.[0]).toContain("📋 DANH SÁCH MÓN");
    expect(menu.replies.at(-1)?.[0]).toContain("• Trà đào — 30.000 đ");
    expect(menu.replies.at(-1)?.[0]).toContain("• Cà phê sữa — 25.000 đ");
    expect(menu.replies.at(-1)?.[0]).not.toContain("Trà ngừng bán");
    expect(keyboardLabels(menu.replies.at(-1)?.[1])).toEqual(Object.values(SERVICE_STAFF_QUICK_ACTIONS));
    expect(menu.replies.at(-1)?.[1]).toMatchObject({ reply_markup: { is_persistent: true, resize_keyboard: true } });
  });

  it("keeps the compact keyboard visible for unknown text", async () => {
    const unknown = context();
    await handleUnknownText(unknown, api());
    expect(unknown.replies.at(-1)?.[0]).toContain("Lệnh chưa được hỗ trợ");
    expect(keyboardLabels(unknown.replies.at(-1)?.[1])).toEqual(Object.values(SERVICE_STAFF_QUICK_ACTIONS));
  });
});
