import type { Telegraf } from "telegraf";

import { type BackendApi } from "../api/backend-client.js";
import type { DraftOrder } from "../api/order-types.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { myOrdersKeyboard, orderStatusKeyboard } from "../keyboards/order-status.js";
import type { BotContext, BotSession } from "../types.js";
import { isAccessDenied } from "./start.handler.js";

export interface OrderStatusContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: object): Promise<unknown>;
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
    await ctx.reply(formatOrderStatus(order), orderStatusKeyboard(order.id));
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải trạng thái đơn. Hãy thử lại.");
  }
}

export function registerOrderStatusHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.action("service:orders:mine", async (ctx) => {
    await ctx.answerCbQuery();
    await showMyOrders({ from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) }, api);
  });

  bot.action(/^order:status:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showOrderStatus(
      { from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) },
      api,
      ctx.match[1],
    );
  });
}
