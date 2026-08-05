import { describe, expect, it, vi } from "vitest";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { DraftOrder, MenuCategory, MenuItem } from "../api/order-types.js";
import { draftCallbackData, type DraftCallbackAction } from "../callbacks/callback-data.js";
import { reviewKeyboard } from "../keyboards/draft-order.js";
import type { BotSession, EmployeeSession } from "../types.js";
import {
  handleDraftCallback,
  handleDraftText,
  startDraftOrder,
  type DraftOrderCallbackContext,
  type DraftOrderContext,
} from "./draft-order.handler.js";
import { handleCreateOrderCallback } from "./callback.handler.js";

const employee: EmployeeSession = {
  employeeId: "employee-1",
  telegramUserId: 1001,
  displayName: "Minh Anh",
  role: "SERVICE_STAFF",
};

const categories: MenuCategory[] = [{ id: "tea", name: "Trà" }];
const menuItems: MenuItem[] = [
  { id: "tea-peach", categoryId: "tea", name: "Trà đào", price: 30_000, isActive: true },
  { id: "sold-out", categoryId: "tea", name: "Hết hàng", price: 25_000, isActive: false },
];

function order(overrides: Partial<DraftOrder> = {}): DraftOrder {
  return {
    id: "order-1",
    code: "OF-001",
    paymentStatus: "UNPAID",
    fulfillmentStatus: "PENDING_PAYMENT",
    totalAmount: 70_000,
    items: [{ id: "line-1", menuItemId: "tea-peach", name: "Trà đào", quantity: 2, unitPrice: 30_000, note: "Ít đá" }],
    ...overrides,
  };
}

function api(overrides: Partial<BackendApi> = {}): BackendApi {
  return {
    createTelegramSession: vi.fn().mockResolvedValue(employee),
    createDraftOrder: vi.fn().mockResolvedValue(order({ items: [], totalAmount: 0 })),
    getMenuCategories: vi.fn().mockResolvedValue(categories),
    getMenuItems: vi.fn().mockResolvedValue(menuItems),
    addDraftOrderItem: vi.fn().mockResolvedValue(order()),
    updateDraftOrderItem: vi.fn().mockResolvedValue(order()),
    deleteDraftOrderItem: vi.fn().mockResolvedValue(order({ items: [], totalAmount: 0 })),
    getDraftOrder: vi.fn().mockResolvedValue(order()),
    cancelDraftOrder: vi.fn().mockResolvedValue(undefined),
    listMyOrders: vi.fn().mockResolvedValue([order()]),
    confirmCashPayment: vi.fn().mockResolvedValue(order({ paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED" })),
    createQrPayment: vi.fn().mockResolvedValue({
      order: order({ paymentMethod: "QR", paymentStatus: "PENDING" }),
      paymentCode: "PAYOF001",
      amount: 70_000,
      qrImageUrl: "https://vietqr.app/img?amount=70000",
    }),
    deliverOrder: vi.fn().mockResolvedValue(order({ fulfillmentStatus: "DELIVERED" })),
    listBaristaQueue: vi.fn().mockResolvedValue([]),
    listBaristaOrders: vi.fn().mockResolvedValue([]),
    getBaristaOrder: vi.fn(),
    getBaristaOrderHistory: vi.fn().mockResolvedValue([]),
    claimBaristaOrder: vi.fn(),
    markBaristaOrderReady: vi.fn(),
    ...overrides,
  };
}

function draftContext(session: DraftOrderContext["session"] = {}): DraftOrderContext & { replies: string[] } {
  const replies: string[] = [];
  return {
    from: { id: employee.telegramUserId },
    session,
    replies,
    reply: async (message) => void replies.push(message),
  };
}

function callbackContext(data: string, session: DraftOrderContext["session"]): DraftOrderCallbackContext & { replies: string[]; answers: string[]; clears: string[] } {
  if (session.draftOrder && !session.draftOrder.callbackRevision) {
    session.draftOrder.callbackRevision = "deadbeef";
  }
  const legacyMatch = /^draft:(category|item|edit|edit-quantity|edit-note|delete):(.+)$/.exec(data);
  const legacyActions: Record<string, DraftCallbackAction> = {
    cancel: "cancel",
    "add-more": "addMore",
    "back:categories": "backCategories",
    "back:review": "backReview",
    "note:skip": "skipNote",
    "pay:cash": "payCash",
    "pay:qr": "payQr",
  };
  const entityActions: Record<string, DraftCallbackAction> = {
    category: "category",
    item: "item",
    edit: "edit",
    "edit-quantity": "editQuantity",
    "edit-note": "editNote",
    delete: "delete",
  };
  const action = legacyActions[data.slice("draft:".length)];
  const callbackData = legacyMatch
    ? draftCallbackData(session.draftOrder?.callbackRevision ?? "deadbeef", entityActions[legacyMatch[1]]!, legacyMatch[2])
    : action
      ? draftCallbackData(session.draftOrder?.callbackRevision ?? "deadbeef", action)
      : data;
  const replies: string[] = [];
  const answers: string[] = [];
  const clears: string[] = [];
  return {
    from: { id: employee.telegramUserId },
    session,
    callbackId: "callback-1",
    callbackData,
    replies,
    answers,
    clears,
    reply: async (message) => void replies.push(message),
    answerCallback: async (message) => void answers.push(message ?? ""),
    clearCallbackMessage: async () => void clears.push("cleared"),
  };
}

describe("Telegram draft order flow", () => {
  it("offers CASH and QR only when the review has items", () => {
    const labels = reviewKeyboard(order(), "deadbeef").reply_markup.inline_keyboard.flat().map((button) => button.text);
    const emptyLabels = reviewKeyboard(order({ items: [], totalAmount: 0 }), "deadbeef").reply_markup.inline_keyboard.flat().map((button) => button.text);
    expect(labels).toEqual(expect.arrayContaining(["Tiền mặt", "QR"]));
    expect(emptyLabels).not.toEqual(expect.arrayContaining(["Tiền mặt", "QR"]));
  });

  it("creates a backend draft and starts at category selection", async () => {
    const ctx = draftContext();
    const backend = api();

    await startDraftOrder(ctx, backend);

    expect(backend.createDraftOrder).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.session.draftOrder).toMatchObject({ orderId: "order-1", step: "CATEGORY" });
    expect(ctx.replies).toEqual(["Chọn danh mục món:"]);
  });

  it("resumes an existing backend draft at review instead of hiding its items", async () => {
    const ctx = draftContext();
    const backend = api({ createDraftOrder: vi.fn().mockResolvedValue(order()) });

    await startDraftOrder(ctx, backend);

    expect(ctx.session.draftOrder?.step).toBe("REVIEW");
    expect(backend.getMenuCategories).not.toHaveBeenCalled();
    expect(ctx.replies.at(-1)).toContain("70.000");
  });

  it("accepts an active menu item, records quantity and note, then renders the server total", async () => {
    const session = { draftOrder: { orderId: "order-1", step: "CATEGORY" as const } };
    const backend = api();

    await handleDraftCallback(callbackContext("draft:category:tea", session), backend);
    await handleDraftCallback(callbackContext("draft:item:tea-peach", session), backend);
    expect(session.draftOrder).toMatchObject({ step: "QUANTITY", selectedMenuItemId: "tea-peach" });

    const quantity = { ...draftContext(session), text: "2" };
    await handleDraftText(quantity, backend);
    expect(session.draftOrder?.step).toBe("NOTE");

    const note = { ...draftContext(session), text: "Ít đá" };
    await handleDraftText(note, backend);
    expect(backend.addDraftOrderItem).toHaveBeenCalledWith(employee.telegramUserId, "order-1", {
      menuItemId: "tea-peach",
      quantity: 2,
      note: "Ít đá",
    });
    expect(note.replies.at(-1)).toContain("Tổng tiền: 70.000");
  });

  it("allows quantity, note and deletion changes from the review screen", async () => {
    const session = { draftOrder: { orderId: "order-1", step: "REVIEW" as const } };
    const backend = api();

    await handleDraftCallback(callbackContext("draft:edit:line-1", session), backend);
    await handleDraftCallback(callbackContext("draft:edit-quantity:line-1", session), backend);
    await handleDraftText({ ...draftContext(session), text: "3" }, backend);
    expect(backend.updateDraftOrderItem).toHaveBeenCalledWith(employee.telegramUserId, "order-1", "line-1", { quantity: 3 });

    await handleDraftCallback(callbackContext("draft:edit-note:line-1", session), backend);
    await handleDraftText({ ...draftContext(session), text: "-" }, backend);
    expect(backend.updateDraftOrderItem).toHaveBeenCalledWith(employee.telegramUserId, "order-1", "line-1", { note: "" });

    await handleDraftCallback(callbackContext("draft:delete:line-1", session), backend);
    expect(backend.deleteDraftOrderItem).toHaveBeenCalledWith(employee.telegramUserId, "order-1", "line-1");
  });

  it("rejects invalid quantity and inactive menu items without changing the draft", async () => {
    const session: BotSession = {
      draftOrder: { orderId: "order-1", step: "QUANTITY", selectedMenuItemId: "tea-peach", quantity: undefined },
    };
    const backend = api();
    const quantity = { ...draftContext(session), text: "0" };
    await handleDraftText(quantity, backend);
    expect(quantity.replies).toEqual(["Số lượng phải là số nguyên từ 1 đến 99."]);

    const activeDraft = session.draftOrder!;
    activeDraft.step = "ITEM";
    activeDraft.categoryId = "tea";
    const inactive = callbackContext("draft:item:sold-out", session);
    await handleDraftCallback(inactive, backend);
    expect(inactive.replies).toEqual(["Món không còn được bán."]);
    expect(backend.addDraftOrderItem).not.toHaveBeenCalled();
  });

  it("rejects an expired draft and prevents duplicate callbacks while one is pending", async () => {
    const expired = callbackContext("draft:add-more", {});
    await handleDraftCallback(expired, api());
    expect(expired.answers).toEqual(["Nút này đã hết hạn."]);

    let releaseCategories: (() => void) | undefined;
    const pendingCategories = new Promise<MenuCategory[]>((resolve) => {
      releaseCategories = () => resolve(categories);
    });
    const session = { draftOrder: { orderId: "order-1", step: "CATEGORY" as const } };
    const backend = api({ getMenuCategories: vi.fn().mockReturnValue(pendingCategories) });
    const first = handleDraftCallback(callbackContext("draft:category:tea", session), backend);
    const second = callbackContext("draft:category:tea", session);
    await handleDraftCallback(second, backend);
    expect(second.answers).toEqual(["Yêu cầu này đang được xử lý."]);
    releaseCategories?.();
    await first;
  });

  it("does not review an order once the backend marks it paid", async () => {
    const session = { draftOrder: { orderId: "order-1", step: "REVIEW" as const } };
    const backend = api({ getDraftOrder: vi.fn().mockResolvedValue(order({ paymentStatus: "PAID" })) });
    const ctx = callbackContext("draft:back:review", session);

    await handleDraftCallback(ctx, backend);

    expect(ctx.replies).toEqual(["Đơn không còn ở trạng thái có thể chỉnh sửa."]);
    expect(ctx.session.draftOrder).toBeUndefined();
  });

  it("does not expose an order that the backend says belongs to another employee", async () => {
    const session = { draftOrder: { orderId: "other-order", step: "REVIEW" as const } };
    const backend = api({
      getDraftOrder: vi.fn().mockRejectedValue(new BackendApiError("Order ownership denied", 403, "ORDER_FORBIDDEN")),
    });
    const ctx = callbackContext("draft:back:review", session);

    await handleDraftCallback(ctx, backend);

    expect(ctx.replies).toEqual(["Đơn này không thuộc quyền thao tác của bạn."]);
  });

  it("completes a CASH order and clears the draft session", async () => {
    const session = { draftOrder: { orderId: "order-1", step: "REVIEW" as const } };
    const backend = api();
    const ctx = callbackContext("draft:pay:cash", session);

    await handleDraftCallback(ctx, backend);

    expect(backend.confirmCashPayment).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(ctx.session.draftOrder).toBeUndefined();
    expect(ctx.replies.at(-1)).toContain("PAID");
    expect(ctx.replies.at(-1)).toContain("QUEUED");
  });

  it("creates a QR payment and shows its payment code", async () => {
    const session = { draftOrder: { orderId: "order-1", step: "REVIEW" as const } };
    const backend = api();
    const ctx = callbackContext("draft:pay:qr", session);

    await handleDraftCallback(ctx, backend);

    expect(backend.createQrPayment).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(ctx.session.draftOrder).toBeUndefined();
    expect(ctx.replies.at(-1)).toContain("PAYOF001");
    expect(ctx.replies.at(-1)).toContain("PENDING");
  });

  it("clears a stale keyboard and cannot apply a callback from another draft", async () => {
    const session: BotSession = { draftOrder: { orderId: "order-2", step: "REVIEW", callbackRevision: "bbbbbbbb" } };
    const backend = api({ getDraftOrder: vi.fn().mockResolvedValue(order({ id: "order-2" })) });
    const stale = callbackContext(draftCallbackData("aaaaaaaa", "payCash"), session);

    await handleDraftCallback(stale, backend);

    expect(stale.clears).toEqual(["cleared"]);
    expect(backend.confirmCashPayment).not.toHaveBeenCalled();
    expect(backend.getDraftOrder).toHaveBeenCalledWith(employee.telegramUserId, "order-2");
  });

  it("treats a legacy callback as stale and refreshes the active draft", async () => {
    const session: BotSession = { draftOrder: { orderId: "order-1", step: "REVIEW", callbackRevision: "deadbeef" } };
    const backend = api();
    const legacy = callbackContext("ignored", session);
    legacy.callbackData = "draft:pay:cash";

    await handleDraftCallback(legacy, backend);

    expect(legacy.clears).toEqual(["cleared"]);
    expect(backend.confirmCashPayment).not.toHaveBeenCalled();
    expect(backend.getDraftOrder).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
  });

  it("executes the same payment callback only once across sequential double-clicks", async () => {
    const session: BotSession = { draftOrder: { orderId: "order-1", step: "REVIEW", callbackRevision: "deadbeef" } };
    const backend = api();
    const data = draftCallbackData("deadbeef", "payCash");

    await handleDraftCallback(callbackContext(data, session), backend);
    const repeated = callbackContext(data, session);
    await handleDraftCallback(repeated, backend);

    expect(backend.confirmCashPayment).toHaveBeenCalledTimes(1);
    expect(repeated.clears).toEqual(["cleared"]);
  });

  it("prevents concurrent and sequential create-order double-clicks", async () => {
    let releaseDraft: ((value: DraftOrder) => void) | undefined;
    const pendingDraft = new Promise<DraftOrder>((resolve) => { releaseDraft = resolve; });
    const backend = api({ createDraftOrder: vi.fn().mockReturnValue(pendingDraft) });
    const session: BotSession = {};
    const first = handleCreateOrderCallback(callbackContext("service:order:create", session), backend);
    const concurrent = callbackContext("service:order:create", session);

    await handleCreateOrderCallback(concurrent, backend);
    expect(concurrent.answers.at(-1)).toContain("đang được xử lý");
    releaseDraft?.(order({ items: [], totalAmount: 0 }));
    await first;

    await handleCreateOrderCallback(callbackContext("service:order:create", session), backend);
    expect(backend.createDraftOrder).toHaveBeenCalledTimes(1);
  });
});
