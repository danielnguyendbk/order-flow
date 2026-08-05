import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { DraftOrder, DraftOrderItem } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { categoryKeyboard, editItemKeyboard, itemKeyboard, noteKeyboard, reviewKeyboard } from "../keyboards/draft-order.js";
import { orderStatusKeyboard, qrPaymentKeyboard } from "../keyboards/order-status.js";
import { roleMenu } from "../keyboards/role-menu.js";
import { formatOrderStatus } from "./order-status.handler.js";
import { isAccessDenied } from "./start.handler.js";
import type { BotContext, BotSession, DraftOrderSession, EmployeeSession } from "../types.js";

const DRAFT_UNAVAILABLE_MESSAGE = "Không thể xử lý đơn nháp. Hãy thử lại.";
const DRAFT_EXPIRED_MESSAGE = "Phiên tạo đơn đã hết hạn. Hãy tạo đơn mới.";

type Keyboard = ReturnType<typeof categoryKeyboard>;

export interface DraftOrderContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: Keyboard): Promise<unknown>;
  replyPhoto?(url: string, caption: string, extra?: Keyboard): Promise<unknown>;
}

export interface DraftOrderCallbackContext extends DraftOrderContext {
  callbackId: string;
  callbackData: string;
  answerCallback(message?: string): Promise<unknown>;
}

function callbackLock(ctx: DraftOrderCallbackContext, key: string): boolean {
  const pending = new Set(ctx.session.pendingCallbacks ?? []);
  if (pending.has(key)) return false;
  pending.add(key);
  ctx.session.pendingCallbacks = [...pending];
  return true;
}

function releaseCallbackLock(ctx: DraftOrderCallbackContext, key: string): void {
  ctx.session.pendingCallbacks = (ctx.session.pendingCallbacks ?? []).filter((pending) => pending !== key);
}

function clearDraft(ctx: DraftOrderContext): void {
  ctx.session.draftOrder = undefined;
}

function activeDraft(ctx: DraftOrderContext): DraftOrderSession | undefined {
  return ctx.session.draftOrder;
}

function isOpenDraft(order: DraftOrder): boolean {
  return order.paymentStatus === "UNPAID" && order.fulfillmentStatus === "PENDING_PAYMENT";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

function formatReview(order: DraftOrder): string {
  const lines = order.items.map(
    (item, index) => `${index + 1}. ${item.name} × ${item.quantity} — ${formatMoney(item.unitPrice * item.quantity)}${item.note ? `\n   Ghi chú: ${item.note}` : ""}`,
  );

  return [`Đơn ${order.code}`, "", ...(lines.length ? lines : ["Chưa có món nào."]), "", `Tổng tiền: ${formatMoney(order.totalAmount)}`].join("\n");
}

async function requireServiceStaff(ctx: DraftOrderContext, api: BackendApi, employee?: EmployeeSession): Promise<EmployeeSession | undefined> {
  const authenticated = employee ?? (await authenticateEmployee(ctx, api));
  if (authenticated.role !== "SERVICE_STAFF") return undefined;
  return authenticated;
}

async function showCategories(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession): Promise<void> {
  const categories = await api.getMenuCategories(employee.telegramUserId);
  if (!categories.length) {
    await ctx.reply("Hiện chưa có danh mục món nào. Bạn có thể hủy đơn nháp.", categoryKeyboard([]));
    return;
  }

  const draft = activeDraft(ctx);
  if (draft) draft.step = "CATEGORY";
  await ctx.reply("Chọn danh mục món:", categoryKeyboard(categories));
}

async function showReview(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
  if (!isOpenDraft(order)) {
    clearDraft(ctx);
    throw new Error("Đơn không còn ở trạng thái có thể chỉnh sửa.");
  }

  draft.step = "REVIEW";
  draft.selectedMenuItemId = undefined;
  draft.selectedMenuItemName = undefined;
  draft.quantity = undefined;
  draft.editingOrderItemId = undefined;
  await ctx.reply(formatReview(order), reviewKeyboard(order));
}

async function showItemEditor(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession, itemId: string): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
  const item = order.items.find((candidate) => candidate.id === itemId);
  if (!item || !isOpenDraft(order)) throw new Error("Món hoặc đơn không còn hợp lệ.");

  draft.step = "REVIEW";
  draft.editingOrderItemId = item.id;
  await ctx.reply(`Chỉnh sửa ${item.name}:`, editItemKeyboard(item));
}

export async function startDraftOrder(ctx: DraftOrderContext, api: BackendApi, employee?: EmployeeSession): Promise<void> {
  try {
    const serviceStaff = await requireServiceStaff(ctx, api, employee);
    if (!serviceStaff) {
      await ctx.reply("Bạn không có quyền tạo đơn.");
      return;
    }

    const order = await api.createDraftOrder(serviceStaff.telegramUserId);
    if (!isOpenDraft(order)) throw new Error("Backend did not create an editable draft order");
    ctx.session.draftOrder = { orderId: order.id, step: "CATEGORY" };
    await showCategories(ctx, api, serviceStaff);
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : DRAFT_UNAVAILABLE_MESSAGE);
  }
}

export async function handleDraftCallback(ctx: DraftOrderCallbackContext, api: BackendApi): Promise<void> {
  const key = ctx.callbackData;
  if (!callbackLock(ctx, key)) {
    await ctx.answerCallback("Yêu cầu này đang được xử lý.");
    return;
  }

  try {
    const employee = await requireServiceStaff(ctx, api);
    if (!employee) {
      await ctx.answerCallback("Bạn không có quyền thao tác đơn.");
      return;
    }

    const draft = activeDraft(ctx);
    if (!draft) {
      await ctx.answerCallback(DRAFT_EXPIRED_MESSAGE);
      return;
    }

    const action = ctx.callbackData;
    const isKnownAction = action === "draft:cancel"
      || action === "draft:add-more"
      || action === "draft:back:categories"
      || action === "draft:back:review"
      || action === "draft:note:skip"
      || action === "draft:pay:cash"
      || action === "draft:pay:qr"
      || action.startsWith("draft:category:")
      || action.startsWith("draft:item:")
      || action.startsWith("draft:edit:")
      || action.startsWith("draft:edit-quantity:")
      || action.startsWith("draft:edit-note:")
      || action.startsWith("draft:delete:");
    if (!isKnownAction) {
      await ctx.answerCallback("Thao tác không còn hợp lệ.");
      return;
    }

    await ctx.answerCallback();
    if (action === "draft:cancel") {
      await api.cancelDraftOrder(employee.telegramUserId, draft.orderId);
      clearDraft(ctx);
      await ctx.reply("Đã hủy đơn nháp.", roleMenu(employee.role));
      return;
    }

    if (action === "draft:add-more" || action === "draft:back:categories") {
      await showCategories(ctx, api, employee);
      return;
    }

    if (action === "draft:back:review") {
      await showReview(ctx, api, employee);
      return;
    }

    if (action === "draft:pay:cash") {
      const paidOrder = await api.confirmCashPayment(employee.telegramUserId, draft.orderId);
      clearDraft(ctx);
      await ctx.reply(`Đã xác nhận thanh toán tiền mặt.\n\n${formatOrderStatus(paidOrder)}`, orderStatusKeyboard(paidOrder));
      return;
    }

    if (action === "draft:pay:qr") {
      const payment = await api.createQrPayment(employee.telegramUserId, draft.orderId);
      clearDraft(ctx);
      const message = `Quét QR để thanh toán ${formatMoney(payment.amount)}.\nNội dung: ${payment.paymentCode}\n\n${formatOrderStatus(payment.order)}`;
      const keyboard = qrPaymentKeyboard(payment.order.id, payment.qrImageUrl);
      if (ctx.replyPhoto) await ctx.replyPhoto(payment.qrImageUrl, message, keyboard);
      else await ctx.reply(message, keyboard);
      return;
    }

    if (action.startsWith("draft:category:")) {
      const categoryId = action.slice("draft:category:".length);
      const categories = await api.getMenuCategories(employee.telegramUserId);
      if (!categories.some((category) => category.id === categoryId)) throw new Error("Danh mục không còn hợp lệ.");
      const items = await api.getMenuItems(employee.telegramUserId, categoryId);
      draft.categoryId = categoryId;
      draft.step = "ITEM";
      await ctx.reply(items.some((item) => item.isActive) ? "Chọn món:" : "Danh mục này hiện không có món đang bán.", itemKeyboard(items));
      return;
    }

    if (action.startsWith("draft:item:")) {
      const menuItemId = action.slice("draft:item:".length);
      if (!draft.categoryId) throw new Error(DRAFT_EXPIRED_MESSAGE);
      const items = await api.getMenuItems(employee.telegramUserId, draft.categoryId);
      const item = items.find((candidate) => candidate.id === menuItemId && candidate.isActive);
      if (!item) throw new Error("Món không còn được bán.");
      draft.selectedMenuItemId = item.id;
      draft.selectedMenuItemName = item.name;
      draft.step = "QUANTITY";
      await ctx.reply(`Nhập số lượng cho ${item.name} (1–99):`);
      return;
    }

    if (action === "draft:note:skip") {
      if (draft.step !== "NOTE" || !draft.selectedMenuItemId || !draft.quantity) throw new Error(DRAFT_EXPIRED_MESSAGE);
      await api.addDraftOrderItem(employee.telegramUserId, draft.orderId, {
        menuItemId: draft.selectedMenuItemId,
        quantity: draft.quantity,
      });
      await showReview(ctx, api, employee);
      return;
    }

    if (action.startsWith("draft:edit:")) {
      await showItemEditor(ctx, api, employee, action.slice("draft:edit:".length));
      return;
    }

    if (action.startsWith("draft:edit-quantity:")) {
      const itemId = action.slice("draft:edit-quantity:".length);
      draft.editingOrderItemId = itemId;
      draft.step = "EDIT_QUANTITY";
      await ctx.reply("Nhập số lượng mới (1–99):");
      return;
    }

    if (action.startsWith("draft:edit-note:")) {
      const itemId = action.slice("draft:edit-note:".length);
      draft.editingOrderItemId = itemId;
      draft.step = "EDIT_NOTE";
      await ctx.reply("Nhập ghi chú mới (hoặc gửi dấu - để xóa ghi chú):");
      return;
    }

    if (action.startsWith("draft:delete:")) {
      await api.deleteDraftOrderItem(employee.telegramUserId, draft.orderId, action.slice("draft:delete:".length));
      await showReview(ctx, api, employee);
      return;
    }

  } catch (error) {
    if (error instanceof BackendApiError && error.code === "ORDER_FORBIDDEN") {
      await ctx.reply("Đơn này không thuộc quyền thao tác của bạn.");
    } else if (isAccessDenied(error)) {
      await ctx.reply("Tài khoản không còn được phép sử dụng.");
    } else if (error instanceof Error && [DRAFT_EXPIRED_MESSAGE, "Danh mục không còn hợp lệ.", "Món không còn được bán.", "Món hoặc đơn không còn hợp lệ.", "Đơn không còn ở trạng thái có thể chỉnh sửa."].includes(error.message)) {
      await ctx.reply(error.message);
    } else {
      await ctx.reply(DRAFT_UNAVAILABLE_MESSAGE);
    }
  } finally {
    releaseCallbackLock(ctx, key);
  }
}

export async function handleDraftText(ctx: DraftOrderContext & { text: string }, api: BackendApi): Promise<boolean> {
  const draft = activeDraft(ctx);
  if (!draft || !["QUANTITY", "NOTE", "EDIT_QUANTITY", "EDIT_NOTE"].includes(draft.step)) return false;

  try {
    const employee = await requireServiceStaff(ctx, api);
    if (!employee) {
      await ctx.reply("Bạn không có quyền thao tác đơn.");
      return true;
    }

    const input = ctx.text.trim();
    if (draft.step === "QUANTITY" || draft.step === "EDIT_QUANTITY") {
      if (!/^[1-9]\d?$/.test(input)) {
        await ctx.reply("Số lượng phải là số nguyên từ 1 đến 99.");
        return true;
      }

      const quantity = Number(input);
      if (draft.step === "QUANTITY") {
        draft.quantity = quantity;
        draft.step = "NOTE";
        await ctx.reply("Nhập ghi chú cho món, hoặc chọn Bỏ qua:", noteKeyboard());
      } else if (draft.editingOrderItemId) {
        await api.updateDraftOrderItem(employee.telegramUserId, draft.orderId, draft.editingOrderItemId, { quantity });
        await showReview(ctx, api, employee);
      }
      return true;
    }

    if (input.length > 250) {
      await ctx.reply("Ghi chú tối đa 250 ký tự.");
      return true;
    }

    if (draft.step === "NOTE" && draft.selectedMenuItemId && draft.quantity) {
      await api.addDraftOrderItem(employee.telegramUserId, draft.orderId, {
        menuItemId: draft.selectedMenuItemId,
        quantity: draft.quantity,
        ...(input ? { note: input } : {}),
      });
      await showReview(ctx, api, employee);
      return true;
    }

    if (draft.step === "EDIT_NOTE" && draft.editingOrderItemId) {
      await api.updateDraftOrderItem(employee.telegramUserId, draft.orderId, draft.editingOrderItemId, { note: input === "-" ? "" : input });
      await showReview(ctx, api, employee);
      return true;
    }
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : DRAFT_UNAVAILABLE_MESSAGE);
    return true;
  }

  await ctx.reply(DRAFT_EXPIRED_MESSAGE);
  return true;
}

export function registerDraftOrderHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.action(/^draft:/, async (ctx) => {
    await handleDraftCallback(
      {
        from: ctx.from,
        session: ctx.session,
        callbackId: ctx.callbackQuery.id,
        callbackData: ctx.match[0],
        reply: (message, extra) => ctx.reply(message, extra),
        replyPhoto: (url, caption, extra) => ctx.replyWithPhoto({ url }, { caption, ...extra }),
        answerCallback: (message) => ctx.answerCbQuery(message),
      },
      api,
    );
  });

  bot.on("text", async (ctx) => {
    await handleDraftText(
      {
        from: ctx.from,
        session: ctx.session,
        text: ctx.message.text,
        reply: (message, extra) => ctx.reply(message, extra),
      },
      api,
    );
  });
}
