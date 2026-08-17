import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { DraftOrder, DraftOrderItem } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { createCallbackRevision, parseDraftCallbackData } from "../callbacks/callback-data.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "../callbacks/callback-guard.js";
import { fulfillmentStatusLabel, paymentStatusLabel } from "../formatters/order-status.js";
import { formatPaymentSelection } from "../formatters/payment-selection.js";
import { backKeyboard, categoryKeyboard, editItemKeyboard, itemKeyboard, noteKeyboard, paymentConfirmationKeyboard, quantityKeyboard, reviewKeyboard } from "../keyboards/draft-order.js";
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
  clearCallbackMessage?(): Promise<unknown>;
}

async function clearStaleKeyboard(ctx: DraftOrderCallbackContext): Promise<void> {
  await ctx.clearCallbackMessage?.().catch(() => undefined);
}

function clearDraft(ctx: DraftOrderContext): void {
  ctx.session.draftOrder = undefined;
}

function activeDraft(ctx: DraftOrderContext): DraftOrderSession | undefined {
  return ctx.session.draftOrder;
}

function rotateDraftRevision(draft: DraftOrderSession): string {
  draft.callbackRevision = createCallbackRevision();
  return draft.callbackRevision;
}

function isOpenDraft(order: DraftOrder): boolean {
  return order.paymentStatus === "UNPAID" && order.fulfillmentStatus === "PENDING_PAYMENT";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

async function requireServiceStaff(ctx: DraftOrderContext, api: BackendApi, employee?: EmployeeSession): Promise<EmployeeSession | undefined> {
  const authenticated = employee ?? (await authenticateEmployee(ctx, api));
  if (authenticated.role !== "SERVICE_STAFF") return undefined;
  return authenticated;
}

async function showCategories(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);
  draft.step = "CATEGORY";
  const revision = rotateDraftRevision(draft);
  const categories = await api.getMenuCategories(employee.telegramUserId);
  if (!categories.length) {
    await ctx.reply("Hiện chưa có danh mục món nào. Bạn có thể hủy đơn nháp.", categoryKeyboard([], revision));
    return;
  }
  await ctx.reply("Chọn danh mục món:", categoryKeyboard(categories, revision));
}

async function showItems(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession, categoryId: string): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const items = await api.getMenuItems(employee.telegramUserId, categoryId);
  draft.categoryId = categoryId;
  draft.step = "ITEM";
  await ctx.reply(
    items.some((item) => item.isActive) ? "Chọn món:" : "Danh mục này hiện không có món đang bán.",
    itemKeyboard(items, rotateDraftRevision(draft)),
  );
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
  draft.pendingPaymentMethod = undefined;
  await ctx.reply(formatPaymentSelection(order), reviewKeyboard(order, rotateDraftRevision(draft)));
}

async function showPaymentConfirmation(
  ctx: DraftOrderContext,
  api: BackendApi,
  employee: EmployeeSession,
  paymentMethod: "CASH" | "QR",
): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
  if (!isOpenDraft(order) || !order.items.length) throw new Error("Đơn không còn ở trạng thái có thể chỉnh sửa.");

  draft.step = "PAYMENT_CONFIRMATION";
  draft.pendingPaymentMethod = paymentMethod;
  const methodLabel = paymentMethod === "CASH" ? "Tiền mặt" : "QR";
  await ctx.reply([
    "⚠️ XÁC NHẬN THANH TOÁN",
    `Đơn: ${order.code}`,
    `Tổng tiền: ${formatMoney(order.totalAmount)}`,
    `Phương thức: ${methodLabel}`,
    "",
    "Vui lòng kiểm tra đúng giao dịch trước khi xác nhận.",
  ].join("\n"), paymentConfirmationKeyboard(rotateDraftRevision(draft)));
}

async function showPaymentMethods(
  ctx: DraftOrderContext,
  api: BackendApi,
  employee: EmployeeSession,
): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
  if (!isOpenDraft(order) || !order.items.length) throw new Error("Đơn không còn ở trạng thái có thể thanh toán.");

  draft.step = "REVIEW";
  draft.pendingPaymentMethod = undefined;
  await ctx.reply(formatPaymentSelection(order), reviewKeyboard(order, rotateDraftRevision(draft)));
}

async function createQrPayment(
  ctx: DraftOrderContext,
  api: BackendApi,
  employee: EmployeeSession,
  orderId: string,
): Promise<void> {
  const payment = await api.createQrPayment(employee.telegramUserId, orderId);
  clearDraft(ctx);
  const message = `Quét QR để thanh toán ${formatMoney(payment.amount)}.\nNội dung: ${payment.paymentCode}\n\n${formatOrderStatus(payment.order)}`;
  const keyboard = qrPaymentKeyboard(payment.order.id);
  if (ctx.replyPhoto) await ctx.replyPhoto(payment.qrImageUrl, message, keyboard);
  else await ctx.reply(message, keyboard);
}

async function showItemEditor(ctx: DraftOrderContext, api: BackendApi, employee: EmployeeSession, itemId: string): Promise<void> {
  const draft = activeDraft(ctx);
  if (!draft) throw new Error(DRAFT_EXPIRED_MESSAGE);

  const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
  const item = order.items.find((candidate) => candidate.id === itemId);
  if (!item || !isOpenDraft(order)) throw new Error("Món hoặc đơn không còn hợp lệ.");

  draft.step = "REVIEW";
  draft.editingOrderItemId = item.id;
  await ctx.reply(`Chỉnh sửa ${item.name}:`, editItemKeyboard(item, rotateDraftRevision(draft)));
}

export async function startDraftOrder(ctx: DraftOrderContext, api: BackendApi, employee?: EmployeeSession): Promise<void> {
  try {
    const serviceStaff = await requireServiceStaff(ctx, api, employee);
    if (!serviceStaff) {
      await ctx.reply("Bạn không có quyền tạo đơn.");
      return;
    }

    if (ctx.session.draftOrder) {
      try {
        const existing = await api.getDraftOrder(serviceStaff.telegramUserId, ctx.session.draftOrder.orderId);
        if (isOpenDraft(existing)) {
          if (existing.items.length) await showReview(ctx, api, serviceStaff);
          else await showCategories(ctx, api, serviceStaff);
          return;
        }
      } catch {
        clearDraft(ctx);
      }
    }

    const order = await api.createDraftOrder(serviceStaff.telegramUserId);
    if (!isOpenDraft(order)) throw new Error("Backend did not create an editable draft order");
    ctx.session.draftOrder = { orderId: order.id, step: "CATEGORY", callbackRevision: createCallbackRevision() };
    if (order.items.length) await showReview(ctx, api, serviceStaff);
    else await showCategories(ctx, api, serviceStaff);
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : DRAFT_UNAVAILABLE_MESSAGE);
  }
}

async function refreshDraftState(
  ctx: DraftOrderContext,
  api: BackendApi,
  employee: EmployeeSession,
  message: string,
): Promise<void> {
  await ctx.reply(message);
  const draft = activeDraft(ctx);
  if (!draft) {
    await ctx.reply("Menu đã được làm mới.", roleMenu(employee.role));
    return;
  }
  try {
    const current = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
    if (!isOpenDraft(current)) {
      clearDraft(ctx);
      await ctx.reply(
        `Đơn ${current.code}: ${paymentStatusLabel(current.paymentStatus)} · ${fulfillmentStatusLabel(current.fulfillmentStatus)}.`,
        roleMenu(employee.role),
      );
      return;
    }
    if (current.items.length) await showReview(ctx, api, employee);
    else await showCategories(ctx, api, employee);
  } catch {
    clearDraft(ctx);
    await ctx.reply("Không thể khôi phục đơn nháp. Menu đã được làm mới.", roleMenu(employee.role));
  }
}

export async function handleDraftCallback(ctx: DraftOrderCallbackContext, api: BackendApi): Promise<void> {
  const key = ctx.callbackData;
  const acquireResult = acquireCallback(ctx.session, key);
  if (acquireResult === "pending") {
    await ctx.answerCallback("Yêu cầu này đang được xử lý.");
    return;
  }
  if (acquireResult === "processed") {
    await clearStaleKeyboard(ctx);
    await ctx.answerCallback("Yêu cầu này đã được xử lý.");
    try {
      const employee = await requireServiceStaff(ctx, api);
      if (employee) await refreshDraftState(ctx, api, employee, "Trạng thái hiện tại đã được làm mới.");
    } catch { /* The callback was already acknowledged. */ }
    return;
  }

  let completed = false;
  try {
    const employee = await requireServiceStaff(ctx, api);
    if (!employee) {
      await ctx.answerCallback("Bạn không có quyền thao tác đơn.");
      return;
    }

    const draft = activeDraft(ctx);
    const callback = parseDraftCallbackData(key);
    if (!draft || !callback || callback.revision !== draft.callbackRevision) {
      await clearStaleKeyboard(ctx);
      await ctx.answerCallback("Nút này đã hết hạn.");
      await refreshDraftState(ctx, api, employee, "Thao tác cũ không còn hợp lệ. Trạng thái đã được làm mới.");
      return;
    }

    await ctx.answerCallback();
    if (callback.action === "cancel") {
      await api.cancelDraftOrder(employee.telegramUserId, draft.orderId);
      clearDraft(ctx);
      await ctx.reply("Đã hủy đơn nháp.", roleMenu(employee.role));
      completed = true;
      return;
    }

    if (callback.action === "addMore" || callback.action === "backCategories") {
      await showCategories(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "backReview") {
      await showReview(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "goBack") {
      if (draft.step === "CATEGORY") {
        await clearStaleKeyboard(ctx);
        await ctx.reply("Đã trở lại menu Staff.", roleMenu(employee.role));
      } else if (draft.step === "ITEM") {
        await showCategories(ctx, api, employee);
      } else if (draft.step === "QUANTITY") {
        if (!draft.categoryId) throw new Error(DRAFT_EXPIRED_MESSAGE);
        await showItems(ctx, api, employee, draft.categoryId);
      } else if (draft.step === "NOTE") {
        if (!draft.selectedMenuItemName) throw new Error(DRAFT_EXPIRED_MESSAGE);
        draft.step = "QUANTITY";
        draft.quantity = undefined;
        await ctx.reply(
          `Chọn số lượng ${draft.selectedMenuItemName}. Nút 1–5 sẽ thêm ngay; nhập số 1–99 nếu món cần ghi chú:`,
          quantityKeyboard(rotateDraftRevision(draft)),
        );
      } else if (draft.step === "PAYMENT_CONFIRMATION") {
        await showPaymentMethods(ctx, api, employee);
      } else if (draft.step === "EDIT_QUANTITY" || draft.step === "EDIT_NOTE") {
        if (!draft.editingOrderItemId) throw new Error(DRAFT_EXPIRED_MESSAGE);
        await showItemEditor(ctx, api, employee, draft.editingOrderItemId);
      } else {
        await showCategories(ctx, api, employee);
      }
      completed = true;
      return;
    }

    if (callback.action === "payCash") {
      await showPaymentConfirmation(ctx, api, employee, "CASH");
      completed = true;
      return;
    }

    if (callback.action === "payQr") {
      await createQrPayment(ctx, api, employee, draft.orderId);
      completed = true;
      return;
    }

    if (callback.action === "cancelPayment") {
      if (draft.step !== "PAYMENT_CONFIRMATION" || !draft.pendingPaymentMethod) throw new Error(DRAFT_EXPIRED_MESSAGE);
      await showPaymentMethods(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "confirmPayment") {
      if (draft.step !== "PAYMENT_CONFIRMATION" || !draft.pendingPaymentMethod) throw new Error(DRAFT_EXPIRED_MESSAGE);

      if (draft.pendingPaymentMethod === "CASH") {
        const paidOrder = await api.confirmCashPayment(employee.telegramUserId, draft.orderId);
        clearDraft(ctx);
        await ctx.reply(`Đã xác nhận thanh toán tiền mặt.\n\n${formatOrderStatus(paidOrder)}`, orderStatusKeyboard(paidOrder));
      } else {
        await createQrPayment(ctx, api, employee, draft.orderId);
      }
      completed = true;
      return;
    }

    if (callback.action === "category") {
      const categoryId = callback.entityId!;
      const categories = await api.getMenuCategories(employee.telegramUserId);
      if (!categories.some((category) => category.id === categoryId)) throw new Error("Danh mục không còn hợp lệ.");
      await showItems(ctx, api, employee, categoryId);
      completed = true;
      return;
    }

    if (callback.action === "item") {
      const menuItemId = callback.entityId!;
      if (!draft.categoryId) throw new Error(DRAFT_EXPIRED_MESSAGE);
      const items = await api.getMenuItems(employee.telegramUserId, draft.categoryId);
      const item = items.find((candidate) => candidate.id === menuItemId && candidate.isActive);
      if (!item) throw new Error("Món không còn được bán.");
      draft.selectedMenuItemId = item.id;
      draft.selectedMenuItemName = item.name;
      draft.step = "QUANTITY";
      await ctx.reply(
        `Chọn số lượng ${item.name}. Nút 1–5 sẽ thêm ngay; nhập số 1–99 nếu món cần ghi chú:`,
        quantityKeyboard(rotateDraftRevision(draft)),
      );
      completed = true;
      return;
    }

    if (callback.action === "quickQuantity") {
      const quantity = Number(callback.entityId);
      if (draft.step !== "QUANTITY" || !draft.selectedMenuItemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        throw new Error(DRAFT_EXPIRED_MESSAGE);
      }
      await api.addDraftOrderItem(employee.telegramUserId, draft.orderId, {
        menuItemId: draft.selectedMenuItemId,
        quantity,
      });
      await showReview(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "skipNote") {
      if (draft.step !== "NOTE" || !draft.selectedMenuItemId || !draft.quantity) throw new Error(DRAFT_EXPIRED_MESSAGE);
      await api.addDraftOrderItem(employee.telegramUserId, draft.orderId, {
        menuItemId: draft.selectedMenuItemId,
        quantity: draft.quantity,
      });
      await showReview(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "edit") {
      await showItemEditor(ctx, api, employee, callback.entityId!);
      completed = true;
      return;
    }

    if (callback.action === "editQuantity") {
      const itemId = callback.entityId!;
      draft.editingOrderItemId = itemId;
      draft.step = "EDIT_QUANTITY";
      await ctx.reply("Nhập số lượng mới (1–99):", backKeyboard(rotateDraftRevision(draft)));
      completed = true;
      return;
    }

    if (callback.action === "decreaseQuantity" || callback.action === "increaseQuantity") {
      const itemId = callback.entityId!;
      const order = await api.getDraftOrder(employee.telegramUserId, draft.orderId);
      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item || !isOpenDraft(order)) throw new Error("Món hoặc đơn không còn hợp lệ.");
      const change = callback.action === "increaseQuantity" ? 1 : -1;
      const quantity = item.quantity + change;
      if (quantity < 1 || quantity > 99) throw new Error("Số lượng phải từ 1 đến 99.");
      await api.updateDraftOrderItem(employee.telegramUserId, draft.orderId, itemId, { quantity });
      await showReview(ctx, api, employee);
      completed = true;
      return;
    }

    if (callback.action === "editNote") {
      const itemId = callback.entityId!;
      draft.editingOrderItemId = itemId;
      draft.step = "EDIT_NOTE";
      await ctx.reply("Nhập ghi chú mới (hoặc gửi dấu - để xóa ghi chú):", backKeyboard(rotateDraftRevision(draft)));
      completed = true;
      return;
    }

    if (callback.action === "delete") {
      await api.deleteDraftOrderItem(employee.telegramUserId, draft.orderId, callback.entityId!);
      await showReview(ctx, api, employee);
      completed = true;
      return;
    }

  } catch (error) {
    if (error instanceof BackendApiError && error.code === "ORDER_FORBIDDEN") {
      await ctx.reply("Đơn này không thuộc quyền thao tác của bạn.");
    } else if (isAccessDenied(error)) {
      await ctx.reply("Tài khoản không còn được phép sử dụng.");
    } else if (error instanceof BackendApiError && ["ORDER_NOT_EDITABLE", "ORDER_NOT_PAYABLE", "ORDER_ITEM_NOT_FOUND", "MENU_ITEM_UNAVAILABLE", "PAYMENT_METHOD_CONFLICT"].includes(error.code ?? "")) {
      await clearStaleKeyboard(ctx);
      const employee = ctx.session.employee;
      if (employee?.role === "SERVICE_STAFF") await refreshDraftState(ctx, api, employee, "Trạng thái đơn vừa thay đổi. Dữ liệu mới nhất đã được tải lại.");
      else await ctx.reply(DRAFT_UNAVAILABLE_MESSAGE);
    } else if (error instanceof Error && [DRAFT_EXPIRED_MESSAGE, "Danh mục không còn hợp lệ.", "Món không còn được bán.", "Món hoặc đơn không còn hợp lệ.", "Đơn không còn ở trạng thái có thể chỉnh sửa."].includes(error.message)) {
      await ctx.reply(error.message);
    } else {
      await ctx.reply(DRAFT_UNAVAILABLE_MESSAGE);
    }
  } finally {
    if (completed) markCallbackCompleted(ctx.session, key);
    releaseCallback(ctx.session, key);
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
        await ctx.reply("Nhập ghi chú cho món, hoặc chọn Bỏ qua:", noteKeyboard(rotateDraftRevision(draft)));
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
  bot.action(/^(?:d:.*|draft:.*)$/, async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : ctx.match[0];
    await handleDraftCallback(
      {
        from: ctx.from,
        session: ctx.session,
        callbackId: ctx.callbackQuery.id,
        callbackData,
        reply: (message, extra) => ctx.reply(message, extra),
        replyPhoto: (url, caption, extra) => ctx.replyWithPhoto({ url }, { caption, ...extra }),
        answerCallback: (message) => ctx.answerCbQuery(message),
        clearCallbackMessage: () => ctx.editMessageReplyMarkup({ inline_keyboard: [] }),
      },
      api,
    );
  });

  bot.on("text", async (ctx, next) => {
    const handled = await handleDraftText(
      {
        from: ctx.from,
        session: ctx.session,
        text: ctx.message.text,
        reply: (message, extra) => ctx.reply(message, extra),
      },
      api,
    );
    if (!handled) return next();
  });
}
