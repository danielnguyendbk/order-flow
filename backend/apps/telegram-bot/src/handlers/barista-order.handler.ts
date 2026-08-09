import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { BaristaOrder, BaristaOrderHistory } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "../callbacks/callback-guard.js";
import { baristaHistoryKeyboard, baristaOrderKeyboard, baristaOrdersKeyboard } from "../keyboards/barista-order.js";
import type { BotContext, BotSession, EmployeeSession } from "../types.js";
import { isAccessDenied } from "./start.handler.js";

export interface BaristaOrderContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: object): Promise<unknown>;
}

export interface BaristaCallbackContext extends BaristaOrderContext {
  callbackData: string;
  answerCallback(message?: string): Promise<unknown>;
  clearCallbackMessage?(): Promise<unknown>;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export function formatBaristaOrder(order: BaristaOrder): string {
  const items = order.items.map((item, index) =>
    `${index + 1}. ${item.name} × ${item.quantity}${item.note ? `\n   Ghi chú: ${item.note}` : ""}`,
  );
  return [
    `Đơn ${order.code}`,
    `Thanh toán: ${order.paymentStatus}`,
    `Pha chế: ${order.fulfillmentStatus}`,
    `Tổng tiền: ${formatMoney(order.totalAmount)}`,
    "",
    ...(items.length ? items : ["Không có món."]),
  ].join("\n");
}

function formatHistory(history: BaristaOrderHistory[]): string {
  if (!history.length) return "Đơn chưa có lịch sử trạng thái.";
  return history.map((entry) => {
    const transition = entry.oldStatus ? `${entry.oldStatus} → ${entry.newStatus}` : entry.newStatus;
    return `${new Date(entry.createdAt).toLocaleString("vi-VN")} · ${entry.statusDomain}: ${transition}`;
  }).join("\n");
}

async function requireBarista(ctx: BaristaOrderContext, api: BackendApi): Promise<EmployeeSession | undefined> {
  const employee = await authenticateEmployee(ctx, api);
  if (employee.role !== "BARISTA") {
    await ctx.reply("Bạn không có quyền thao tác hàng đợi pha chế.");
    return undefined;
  }
  return employee;
}

export async function showBaristaQueue(ctx: BaristaOrderContext, api: BackendApi): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api);
    if (!employee) return;
    const orders = await api.listBaristaQueue(employee.telegramUserId);
    if (!orders.length) {
      await ctx.reply("Hiện không có đơn nào đang chờ pha chế.");
      return;
    }
    await ctx.reply("Chọn đơn đang chờ pha chế:", baristaOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải hàng đợi pha chế. Hãy thử lại.");
  }
}

export async function showBaristaOrders(ctx: BaristaOrderContext, api: BackendApi): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api);
    if (!employee) return;
    const orders = await api.listBaristaOrders(employee.telegramUserId);
    if (!orders.length) {
      await ctx.reply("Bạn chưa xử lý đơn pha chế nào.");
      return;
    }
    await ctx.reply("Các đơn pha chế của bạn:", baristaOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải lịch sử pha chế. Hãy thử lại.");
  }
}

export async function showBaristaOrder(ctx: BaristaOrderContext, api: BackendApi, orderId: string): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api);
    if (!employee) return;
    const order = await api.getBaristaOrder(employee.telegramUserId, orderId);
    await ctx.reply(formatBaristaOrder(order), baristaOrderKeyboard(order));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải chi tiết đơn. Đơn có thể đã được Barista khác nhận.");
  }
}

async function refreshBaristaState(
  ctx: BaristaOrderContext,
  api: BackendApi,
  employee: EmployeeSession,
  message: string,
  orderId?: string,
): Promise<void> {
  await ctx.reply(message);
  if (orderId) {
    try {
      const order = await api.getBaristaOrder(employee.telegramUserId, orderId);
      await ctx.reply(formatBaristaOrder(order), baristaOrderKeyboard(order));
      return;
    } catch { /* Fall back to the current queue. */ }
  }
  const queue = await api.listBaristaQueue(employee.telegramUserId);
  await ctx.reply(
    queue.length ? "Hàng đợi mới nhất:" : "Hiện không có đơn nào đang chờ pha chế.",
    queue.length ? baristaOrdersKeyboard(queue) : undefined,
  );
}

export async function handleBaristaCallback(ctx: BaristaCallbackContext, api: BackendApi): Promise<void> {
  const key = ctx.callbackData;
  let answered = false;
  const acquireResult = acquireCallback(ctx.session, key);
  if (acquireResult !== "acquired") {
    await ctx.answerCallback(acquireResult === "processed" ? "Yêu cầu này đã được xử lý." : "Yêu cầu này đang được xử lý.");
    if (acquireResult === "processed") {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      try {
        const employee = await requireBarista(ctx, api);
        const [, orderId] = parseAction(key);
        if (employee) await refreshBaristaState(ctx, api, employee, "Trạng thái hiện tại đã được làm mới.", orderId);
      } catch { /* The callback was already acknowledged. */ }
    }
    return;
  }

  let completed = false;
  try {
    const employee = await requireBarista(ctx, api);
    if (!employee) {
      await ctx.answerCallback("Bạn không có quyền thao tác.");
      answered = true;
      return;
    }
    await ctx.answerCallback();
    answered = true;

    if (key === "barista:queue") {
      const orders = await api.listBaristaQueue(employee.telegramUserId);
      await ctx.reply(orders.length ? "Chọn đơn đang chờ pha chế:" : "Hiện không có đơn nào đang chờ pha chế.", orders.length ? baristaOrdersKeyboard(orders) : undefined);
      return;
    }
    if (key === "barista:orders:mine") {
      const orders = await api.listBaristaOrders(employee.telegramUserId);
      await ctx.reply(orders.length ? "Các đơn pha chế của bạn:" : "Bạn chưa xử lý đơn pha chế nào.", orders.length ? baristaOrdersKeyboard(orders) : undefined);
      return;
    }

    const [action, orderId] = parseAction(key);
    if (!action || !orderId) {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      await refreshBaristaState(ctx, api, employee, "Thao tác cũ không còn hợp lệ. Hàng đợi đã được làm mới.");
      return;
    }
    if (action === "view") {
      const order = await api.getBaristaOrder(employee.telegramUserId, orderId);
      await ctx.reply(formatBaristaOrder(order), baristaOrderKeyboard(order));
      completed = true;
      return;
    }
    if (action === "claim") {
      const order = await api.claimBaristaOrder(employee.telegramUserId, orderId);
      await ctx.reply(`Đã nhận đơn.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
      completed = true;
      return;
    }
    if (action === "ready") {
      const order = await api.markBaristaOrderReady(employee.telegramUserId, orderId);
      await ctx.reply(`Đã đánh dấu pha chế xong.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
      completed = true;
      return;
    }
    const history = await api.getBaristaOrderHistory(employee.telegramUserId, orderId);
    await ctx.reply(`Lịch sử đơn:\n${formatHistory(history)}`, baristaHistoryKeyboard(orderId));
    completed = true;
  } catch (error) {
    if (!answered) {
      await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý yêu cầu.").catch(() => undefined);
    }
    if (error instanceof BackendApiError && ["ORDER_ALREADY_CLAIMED", "ORDER_STATE_CHANGED", "ORDER_NOT_CLAIMABLE", "ORDER_NOT_PREPARING"].includes(error.code ?? "")) {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      const employee = ctx.session.employee;
      const [, orderId] = parseAction(key);
      if (employee?.role === "BARISTA") await refreshBaristaState(ctx, api, employee, "Trạng thái đơn vừa thay đổi. Dữ liệu mới nhất đã được tải lại.", orderId);
      else await ctx.reply("Trạng thái đơn vừa thay đổi.");
    } else {
      await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý đơn pha chế. Hãy thử lại.");
    }
  } finally {
    if (completed) markCallbackCompleted(ctx.session, key);
    releaseCallback(ctx.session, key);
  }
}

function parseAction(data: string): ["view" | "claim" | "ready" | "history" | undefined, string | undefined] {
  const match = /^barista:(view|claim|ready|history):(.+)$/.exec(data);
  return [match?.[1] as "view" | "claim" | "ready" | "history" | undefined, match?.[2]];
}

export function registerBaristaOrderHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.action(/^barista:.*$/, async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : ctx.match[0];
    await handleBaristaCallback({
      from: ctx.from,
      session: ctx.session,
      callbackData,
      reply: (message, extra) => ctx.reply(message, extra),
      answerCallback: (message) => ctx.answerCbQuery(message),
      clearCallbackMessage: () => ctx.editMessageReplyMarkup({ inline_keyboard: [] }),
    }, api);
  });
}
