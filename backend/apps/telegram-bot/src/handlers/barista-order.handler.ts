import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { BaristaOrder, BaristaOrderHistory } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
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

export async function handleBaristaCallback(ctx: BaristaCallbackContext, api: BackendApi): Promise<void> {
  const key = ctx.callbackData;
  let answered = false;
  const pending = new Set(ctx.session.pendingCallbacks ?? []);
  if (pending.has(key)) {
    await ctx.answerCallback("Yêu cầu này đang được xử lý.");
    return;
  }
  pending.add(key);
  ctx.session.pendingCallbacks = [...pending];

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
      await ctx.reply("Thao tác không còn hợp lệ.");
      return;
    }
    if (action === "view") {
      const order = await api.getBaristaOrder(employee.telegramUserId, orderId);
      await ctx.reply(formatBaristaOrder(order), baristaOrderKeyboard(order));
      return;
    }
    if (action === "claim") {
      const order = await api.claimBaristaOrder(employee.telegramUserId, orderId);
      await ctx.reply(`Đã nhận đơn.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
      return;
    }
    if (action === "ready") {
      const order = await api.markBaristaOrderReady(employee.telegramUserId, orderId);
      await ctx.reply(`Đã đánh dấu pha chế xong.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
      return;
    }
    const history = await api.getBaristaOrderHistory(employee.telegramUserId, orderId);
    await ctx.reply(`Lịch sử đơn:\n${formatHistory(history)}`, baristaHistoryKeyboard(orderId));
  } catch (error) {
    if (!answered) {
      await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý yêu cầu.").catch(() => undefined);
    }
    if (error instanceof BackendApiError && ["ORDER_ALREADY_CLAIMED", "ORDER_STATE_CHANGED", "ORDER_NOT_CLAIMABLE", "ORDER_NOT_PREPARING"].includes(error.code ?? "")) {
      await ctx.reply("Trạng thái đơn vừa thay đổi. Hãy làm mới hàng đợi hoặc chi tiết đơn.");
    } else {
      await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý đơn pha chế. Hãy thử lại.");
    }
  } finally {
    ctx.session.pendingCallbacks = (ctx.session.pendingCallbacks ?? []).filter((value) => value !== key);
  }
}

function parseAction(data: string): ["view" | "claim" | "ready" | "history" | undefined, string | undefined] {
  const match = /^barista:(view|claim|ready|history):(.+)$/.exec(data);
  return [match?.[1] as "view" | "claim" | "ready" | "history" | undefined, match?.[2]];
}

export function registerBaristaOrderHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.action(/^barista:.*$/, async (ctx) => {
    await handleBaristaCallback({
      from: ctx.from,
      session: ctx.session,
      callbackData: ctx.match[0],
      reply: (message, extra) => ctx.reply(message, extra),
      answerCallback: (message) => ctx.answerCbQuery(message),
    }, api);
  });
}
