import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { DraftOrder } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "../callbacks/callback-guard.js";
import { myOrdersKeyboard, orderStatusKeyboard } from "../keyboards/order-status.js";
import type { BotContext, BotSession } from "../types.js";
import { isAccessDenied } from "./start.handler.js";

export interface OrderStatusContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: object): Promise<unknown>;
  clearCallbackMessage?(): Promise<unknown>;
}

export interface OrderStatusCallbackContext extends OrderStatusContext {
  callbackData: string;
  answerCallback(message?: string): Promise<unknown>;
  clearCallbackMessage?(): Promise<unknown>;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export function formatOrderStatus(order: DraftOrder): string {
  const paymentMethod = order.paymentMethod === "CASH" ? "Tiền mặt" : order.paymentMethod === "QR" ? "QR" : "Chưa chọn";
  return [
    `Đơn ${order.code}`,
    `Tổng tiền: ${formatMoney(order.totalAmount)}`,
    `Thanh toán: ${paymentMethod} · ${order.paymentStatus}`,
    `Pha chế: ${order.fulfillmentStatus}`,
  ].join("\n");
}

export async function showMyOrders(ctx: OrderStatusContext, api: BackendApi): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await ctx.reply("Bạn không có quyền xem danh sách đơn này.");
      return;
    }
    const orders = await api.listMyOrders(employee.telegramUserId);
    if (!orders.length) {
      await ctx.reply("Bạn chưa có đơn nào.");
      return;
    }
    await ctx.reply("Chọn đơn để xem trạng thái:", myOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải danh sách đơn. Hãy thử lại.");
  }
}

export async function showOrderStatus(ctx: OrderStatusContext, api: BackendApi, orderId: string): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await ctx.reply("Bạn không có quyền xem đơn này.");
      return;
    }
    const order = await api.getDraftOrder(employee.telegramUserId, orderId);
    await ctx.reply(formatOrderStatus(order), orderStatusKeyboard(order));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải trạng thái đơn. Hãy thử lại.");
  }
}

export async function deliverServiceOrder(ctx: OrderStatusContext, api: BackendApi, orderId: string): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await ctx.reply("Bạn không có quyền giao đơn này.");
      return;
    }
    const order = await api.deliverOrder(employee.telegramUserId, orderId);
    await ctx.reply(`Đã xác nhận giao đơn.\n\n${formatOrderStatus(order)}`, orderStatusKeyboard(order));
  } catch (error) {
    if (error instanceof BackendApiError && ["ORDER_NOT_READY", "ORDER_STATE_CHANGED", "ORDER_NOT_EDITABLE"].includes(error.code ?? "")) {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      try {
        const employee = ctx.session.employee;
        if (employee?.role !== "SERVICE_STAFF") throw error;
        const current = await api.getDraftOrder(employee.telegramUserId, orderId);
        await ctx.reply(`Trạng thái đơn vừa thay đổi. Dữ liệu mới nhất:\n\n${formatOrderStatus(current)}`, orderStatusKeyboard(current));
        return;
      } catch { /* Fall through to the standard error below. */ }
    }
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xác nhận giao đơn. Hãy làm mới trạng thái.");
  }
}

export async function handleOrderStatusCallback(ctx: OrderStatusCallbackContext, api: BackendApi): Promise<void> {
  const key = ctx.callbackData;
  const acquireResult = acquireCallback(ctx.session, key);
  if (acquireResult !== "acquired") {
    await ctx.answerCallback(acquireResult === "processed" ? "Yêu cầu này đã được xử lý." : "Yêu cầu này đang được xử lý.");
    if (acquireResult === "processed") {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      const orderId = key.split(":").slice(2).join(":");
      await showOrderStatus(ctx, api, orderId);
    }
    return;
  }

  let completed = false;
  try {
    const match = /^order:(status|deliver):(.+)$/.exec(key);
    if (!match) {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      await ctx.answerCallback("Nút này đã hết hạn.");
      await showMyOrders(ctx, api);
      return;
    }
    await ctx.answerCallback();
    if (match[1] === "status") await showOrderStatus(ctx, api, match[2]);
    else {
      await deliverServiceOrder(ctx, api, match[2]);
      completed = true;
    }
  } finally {
    if (completed) markCallbackCompleted(ctx.session, key);
    releaseCallback(ctx.session, key);
  }
}

export function registerOrderStatusHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.action("service:orders:mine", async (ctx) => {
    await ctx.answerCbQuery();
    await showMyOrders({ from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) }, api);
  });

  bot.action(/^order:.*$/, async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : ctx.match[0];
    await handleOrderStatusCallback({
      from: ctx.from,
      session: ctx.session,
      callbackData,
      reply: (message, extra) => ctx.reply(message, extra),
      answerCallback: (message) => ctx.answerCbQuery(message),
      clearCallbackMessage: () => ctx.editMessageReplyMarkup({ inline_keyboard: [] }),
    }, api);
  });
}
