import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import {
  BARISTA_QUICK_ACTIONS,
  baristaQuickKeyboard,
  roleMenu,
  serviceStaffQuickKeyboard,
} from "../keyboards/role-menu.js";
import type { BotContext, BotSession } from "../types.js";
import { showActiveBaristaOrders, showBaristaOrders, showBaristaQueue } from "./barista-order.handler.js";
import { isAccessDenied } from "./start.handler.js";

export type BaristaQuickAction = "queue" | "active" | "orders" | "menu";

export interface BaristaMenuContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: object): Promise<unknown>;
}

export async function handleBaristaQuickAction(
  ctx: BaristaMenuContext,
  api: BackendApi,
  action: BaristaQuickAction,
): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "BARISTA") {
      await ctx.reply(
        "Thao tác này chỉ dành cho Barista.",
        employee.role === "SERVICE_STAFF" ? serviceStaffQuickKeyboard() : roleMenu(employee.role),
      );
      return;
    }

    if (action === "queue") {
      await showBaristaQueue(ctx, api, employee);
      return;
    }
    if (action === "active") {
      await showActiveBaristaOrders(ctx, api, employee);
      return;
    }
    if (action === "orders") {
      await showBaristaOrders(ctx, api, employee);
      return;
    }
    await ctx.reply("Thao tác pha chế:", baristaQuickKeyboard());
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tải menu pha chế. Hãy thử lại.");
  }
}

export function registerBaristaQuickHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  const run = (ctx: BotContext, action: BaristaQuickAction) => handleBaristaQuickAction(
    { from: ctx.from, session: ctx.session, reply: (message, extra) => ctx.reply(message, extra) },
    api,
    action,
  );

  bot.command("queue", (ctx) => run(ctx, "queue"));
  bot.command("brewing", (ctx) => run(ctx, "active"));
  bot.command("baristaorders", (ctx) => run(ctx, "orders"));

  bot.hears(BARISTA_QUICK_ACTIONS.queue, (ctx) => run(ctx, "queue"));
  bot.hears(BARISTA_QUICK_ACTIONS.active, (ctx) => run(ctx, "active"));
  bot.hears(BARISTA_QUICK_ACTIONS.orders, (ctx) => run(ctx, "orders"));
  bot.hears(BARISTA_QUICK_ACTIONS.menu, (ctx) => run(ctx, "menu"));
}
