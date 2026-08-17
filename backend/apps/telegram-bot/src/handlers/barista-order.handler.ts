import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { BaristaOrder, BaristaOrderHistory } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "../callbacks/callback-guard.js";
import { paymentStatusLabel, statusDomainLabel, statusTransitionLabel } from "../formatters/order-status.js";
import { baristaHistoryKeyboard, baristaOrderKeyboard, baristaOrdersKeyboard, baristaStatusLabel } from "../keyboards/barista-order.js";
import { baristaQuickKeyboard } from "../keyboards/role-menu.js";
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
    `${index + 1}. ${item.quantity} × ${item.name}${item.note ? `\n   LƯU Ý: ${item.note}` : ""}`,
  );
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return [
    `☕ ĐƠN ${order.code}`,
    `Trạng thái: ${baristaStatusLabel(order.fulfillmentStatus)}`,
    `Số món: ${count}`,
    "",
    ...(items.length ? items : ["Không có món."]),
    "",
    `Tổng: ${formatMoney(order.totalAmount)} · Thanh toán: ${paymentStatusLabel(order.paymentStatus)}`,
  ].join("\n");
}

function elapsedLabel(createdAt: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút`;
  const hours = Math.floor(elapsedMinutes / 60);
  return `${hours} giờ ${elapsedMinutes % 60} phút`;
}

export function formatBaristaOrderList(title: string, orders: BaristaOrder[]): string {
  const visible = orders.slice(0, 10);
  const lines = visible.flatMap((order, index) => {
    const count = order.items.reduce((total, item) => total + item.quantity, 0);
    const itemSummary = order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");
    return [
      `${index + 1}. ${order.code} · ${count} món · ${elapsedLabel(order.createdAt)}`,
      `   ${itemSummary || "Không có món"}`,
    ];
  });
  return [
    `${title} · ${orders.length} đơn`,
    "",
    ...lines,
    ...(orders.length > visible.length ? ["", `Đang hiển thị ${visible.length}/${orders.length} đơn.`] : []),
  ].join("\n");
}

function formatHistory(history: BaristaOrderHistory[]): string {
  if (!history.length) return "Đơn chưa có lịch sử trạng thái.";
  return history.map((entry) => {
    const newStatus = statusTransitionLabel(entry.statusDomain, entry.newStatus);
    const transition = entry.oldStatus
      ? `${statusTransitionLabel(entry.statusDomain, entry.oldStatus)} → ${newStatus}`
      : newStatus;
    return `${new Date(entry.createdAt).toLocaleString("vi-VN")} · ${statusDomainLabel(entry.statusDomain)}: ${transition}`;
  }).join("\n");
}

async function requireBarista(ctx: BaristaOrderContext, api: BackendApi, authenticatedEmployee?: EmployeeSession): Promise<EmployeeSession | undefined> {
  const employee = authenticatedEmployee ?? await authenticateEmployee(ctx, api);
  if (employee.role !== "BARISTA") {
    await ctx.reply("Bạn không có quyền thao tác hàng đợi pha chế.");
    return undefined;
  }
  return employee;
}

export async function showBaristaQueue(ctx: BaristaOrderContext, api: BackendApi, authenticatedEmployee?: EmployeeSession): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api, authenticatedEmployee);
    if (!employee) return;
    const orders = await api.listBaristaQueue(employee.telegramUserId);
    if (!orders.length) {
      await ctx.reply("Hàng đợi đang trống.", baristaQuickKeyboard());
      return;
    }
    await ctx.reply(formatBaristaOrderList("HÀNG ĐỢI", orders), baristaOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải hàng đợi pha chế. Hãy thử lại.");
  }
}

export async function showBaristaOrders(ctx: BaristaOrderContext, api: BackendApi, authenticatedEmployee?: EmployeeSession): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api, authenticatedEmployee);
    if (!employee) return;
    const orders = await api.listBaristaOrders(employee.telegramUserId);
    if (!orders.length) {
      await ctx.reply("Bạn chưa xử lý đơn pha chế nào.");
      return;
    }
    await ctx.reply(formatBaristaOrderList("ĐƠN CỦA TÔI", orders), baristaOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải lịch sử pha chế. Hãy thử lại.");
  }
}

export async function showActiveBaristaOrders(ctx: BaristaOrderContext, api: BackendApi, authenticatedEmployee?: EmployeeSession): Promise<void> {
  try {
    const employee = await requireBarista(ctx, api, authenticatedEmployee);
    if (!employee) return;
    const orders = (await api.listBaristaOrders(employee.telegramUserId))
      .filter((order) => order.fulfillmentStatus === "PREPARING");
    if (!orders.length) {
      await ctx.reply("Bạn không có đơn nào đang pha.", baristaQuickKeyboard());
      return;
    }
    await ctx.reply(formatBaristaOrderList("ĐANG PHA", orders), baristaOrdersKeyboard(orders));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải đơn đang pha. Hãy thử lại.");
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
    queue.length ? formatBaristaOrderList("HÀNG ĐỢI MỚI NHẤT", queue) : "Hàng đợi đang trống.",
    queue.length ? baristaOrdersKeyboard(queue) : baristaQuickKeyboard(),
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
      await ctx.reply(orders.length ? formatBaristaOrderList("HÀNG ĐỢI", orders) : "Hàng đợi đang trống.", orders.length ? baristaOrdersKeyboard(orders) : baristaQuickKeyboard());
      return;
    }
    if (key === "barista:active") {
      const orders = (await api.listBaristaOrders(employee.telegramUserId))
        .filter((order) => order.fulfillmentStatus === "PREPARING");
      await ctx.reply(orders.length ? formatBaristaOrderList("ĐANG PHA", orders) : "Bạn không có đơn nào đang pha.", orders.length ? baristaOrdersKeyboard(orders) : baristaQuickKeyboard());
      return;
    }
    if (key === "barista:orders:mine") {
      const orders = await api.listBaristaOrders(employee.telegramUserId);
      await ctx.reply(orders.length ? formatBaristaOrderList("ĐƠN CỦA TÔI", orders) : "Bạn chưa xử lý đơn pha chế nào.", orders.length ? baristaOrdersKeyboard(orders) : baristaQuickKeyboard());
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
      await ctx.reply(`Đã nhận đơn và bắt đầu pha.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
      completed = true;
      return;
    }
    if (action === "ready") {
      const order = await api.markBaristaOrderReady(employee.telegramUserId, orderId);
      await ctx.reply(`Đã pha xong, đơn đang chờ giao.\n\n${formatBaristaOrder(order)}`, baristaOrderKeyboard(order));
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
