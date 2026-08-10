import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import {
  baristaQuickKeyboard,
  roleMenu,
  SERVICE_STAFF_QUICK_ACTIONS,
  serviceStaffQuickKeyboard,
} from "../keyboards/role-menu.js";
import type { BotContext, BotSession, EmployeeSession } from "../types.js";
import { startDraftOrder } from "./draft-order.handler.js";
import { showMyOrders } from "./order-status.handler.js";
import { isAccessDenied } from "./start.handler.js";

export type ServiceQuickAction = "order" | "cart" | "orders" | "menu";

export interface ServiceMenuContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: object): Promise<unknown>;
}

async function showRoleMenu(ctx: ServiceMenuContext, employee: EmployeeSession, unknownCommand = false): Promise<void> {
  if (employee.role === "SERVICE_STAFF") {
    await ctx.reply(
      unknownCommand ? "Lệnh chưa được hỗ trợ. Chọn thao tác nhanh:" : "⚡ Thao tác nhanh:",
      serviceStaffQuickKeyboard(),
    );
    return;
  }
  if (employee.role === "BARISTA") {
    await ctx.reply(
      unknownCommand ? "Lệnh chưa được hỗ trợ. Chọn thao tác pha chế:" : "Thao tác pha chế:",
      baristaQuickKeyboard(),
    );
    return;
  }
  await ctx.reply(unknownCommand ? "Lệnh chưa được hỗ trợ. Menu đã được làm mới." : "Menu:", roleMenu(employee.role));
}

export async function handleServiceQuickAction(
  ctx: ServiceMenuContext,
  api: BackendApi,
  action: ServiceQuickAction,
): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await showRoleMenu(ctx, employee);
      return;
    }

    if (action === "order" || action === "cart") {
      await startDraftOrder(ctx, api, employee);
      return;
    }
    if (action === "orders") {
      await showMyOrders(ctx, api, employee);
      return;
    }
    await showRoleMenu(ctx, employee);
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải menu. Hãy thử lại.");
  }
}

export async function handleUnknownText(ctx: ServiceMenuContext, api: BackendApi): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    await showRoleMenu(ctx, employee, true);
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải menu. Hãy thử lại.");
  }
}

export function registerServiceQuickHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  const run = (ctx: BotContext, action: ServiceQuickAction) => handleServiceQuickAction(
    { from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) },
    api,
    action,
  );

  bot.command("order", (ctx) => run(ctx, "order"));
  bot.command("cart", (ctx) => run(ctx, "cart"));
  bot.command(["orders", "status"], (ctx) => run(ctx, "orders"));
  bot.command(["menu", "help"], (ctx) => run(ctx, "menu"));

  bot.hears(SERVICE_STAFF_QUICK_ACTIONS.order, (ctx) => run(ctx, "order"));
  bot.hears(SERVICE_STAFF_QUICK_ACTIONS.cart, (ctx) => run(ctx, "cart"));
  bot.hears(SERVICE_STAFF_QUICK_ACTIONS.orders, (ctx) => run(ctx, "orders"));
  bot.hears(SERVICE_STAFF_QUICK_ACTIONS.menu, (ctx) => run(ctx, "menu"));
}

export function registerMenuFallbackHandler(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.on("text", (ctx) => handleUnknownText(
    { from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) },
    api,
  ));
}
