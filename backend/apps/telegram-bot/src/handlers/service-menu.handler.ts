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

const TELEGRAM_MENU_MESSAGE_LIMIT = 3_500;

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
}

function splitMenuMessages(lines: string[]): string[] {
  const messages: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= TELEGRAM_MENU_MESSAGE_LIMIT) {
      current = next;
      continue;
    }
    if (current) messages.push(current);
    current = line;
  }

  if (current) messages.push(current);
  return messages;
}

async function showFullMenu(ctx: ServiceMenuContext, api: BackendApi, employee: EmployeeSession): Promise<void> {
  const categories = await api.getMenuCategories(employee.telegramUserId);
  const categoryItems = await Promise.all(
    categories.map(async (category) => ({
      category,
      items: (await api.getMenuItems(employee.telegramUserId, category.id)).filter((item) => item.isActive),
    })),
  );
  const availableCategories = categoryItems.filter(({ items }) => items.length > 0);

  if (availableCategories.length === 0) {
    await ctx.reply("Menu hiện chưa có món đang bán.", serviceStaffQuickKeyboard());
    return;
  }

  const lines = ["📋 DANH SÁCH MÓN", ""];
  availableCategories.forEach(({ category, items }, categoryIndex) => {
    lines.push(`☕ ${category.name.toUpperCase()}`);
    items.forEach((item) => lines.push(`• ${item.name} — ${formatMoney(item.price)} đ`));
    if (categoryIndex < availableCategories.length - 1) lines.push("");
  });

  const messages = splitMenuMessages(lines);
  for (const [index, message] of messages.entries()) {
    await ctx.reply(message, index === messages.length - 1 ? serviceStaffQuickKeyboard() : undefined);
  }
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
    await showFullMenu(ctx, api, employee);
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
