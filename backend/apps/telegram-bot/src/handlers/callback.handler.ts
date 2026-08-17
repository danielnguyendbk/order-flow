import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee, type EmployeeAuthenticationApi } from "../auth/employee-auth.js";
import { acquireCallback, markCallbackCompleted, releaseCallback } from "../callbacks/callback-guard.js";
import { roleMenu } from "../keyboards/role-menu.js";
import { startDraftOrder } from "./draft-order.handler.js";
import { isAccessDenied } from "./start.handler.js";
import type { BotContext, BotSession, EmployeeRole } from "../types.js";

type CallbackAction = {
  role: EmployeeRole;
  message?: string;
};

const actions: Record<string, CallbackAction> = {
  "service:order:create": { role: "SERVICE_STAFF" },
};

export interface CallbackHandlerContext {
  from?: { id: number };
  session: BotSession;
  callbackId: string;
  callbackData?: string;
  reply(message: string, extra?: object): Promise<unknown>;
  answerCallback(message?: string): Promise<unknown>;
  clearCallbackMessage?(): Promise<unknown>;
}

export async function handleCallback(ctx: CallbackHandlerContext, api: EmployeeAuthenticationApi): Promise<void> {
  if (!ctx.callbackData) {
    await ctx.answerCallback("Thao tác không còn hợp lệ.");
    return;
  }
  const actionKey = ctx.callbackData ?? ctx.callbackId;
  const acquireResult = acquireCallback(ctx.session, actionKey);
  if (acquireResult !== "acquired") {
    await ctx.answerCallback(acquireResult === "processed" ? "Yêu cầu này đã được xử lý." : "Yêu cầu này đang được xử lý.");
    return;
  }

  let completed = false;
  try {
    const employee = await authenticateEmployee(ctx, api);
    const action = actions[ctx.callbackData];
    if (!action || employee.role !== action.role) {
      await ctx.clearCallbackMessage?.().catch(() => undefined);
      await ctx.answerCallback("Thao tác không còn hợp lệ.");
      await ctx.reply("Menu đã được làm mới.", roleMenu(employee.role));
      return;
    }

    await ctx.answerCallback();
    if (action.message) await ctx.reply(action.message);
    completed = true;
  } catch (error) {
    await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý. Hãy thử lại.");
  } finally {
    if (completed) markCallbackCompleted(ctx.session, actionKey);
    releaseCallback(ctx.session, actionKey);
  }
}

export async function handleCreateOrderCallback(ctx: CallbackHandlerContext, api: BackendApi): Promise<void> {
  const actionKey = ctx.callbackData ?? "service:order:create";
  const acquireResult = acquireCallback(ctx.session, actionKey);
  if (acquireResult !== "acquired") {
    await ctx.answerCallback(acquireResult === "processed" ? "Yêu cầu này đã được xử lý." : "Yêu cầu này đang được xử lý.");
    if (acquireResult === "processed") {
      try {
        const employee = await authenticateEmployee(ctx, api);
        if (employee.role === "SERVICE_STAFF") await startDraftOrder(ctx, api, employee);
      } catch { /* The callback was already acknowledged. */ }
    }
    return;
  }

  let completed = false;
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await ctx.answerCallback("Bạn không có quyền tạo đơn.");
      await ctx.reply("Menu đã được làm mới.", roleMenu(employee.role));
      return;
    }
    await ctx.answerCallback();
    await startDraftOrder(ctx, api, employee);
    completed = true;
  } catch (error) {
    await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể tạo đơn. Hãy thử lại.");
  } finally {
    if (completed) markCallbackCompleted(ctx.session, actionKey);
    releaseCallback(ctx.session, actionKey);
  }
}

export function registerCallbackHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.on("callback_query", async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    if (callbackData?.startsWith("d:") || callbackData?.startsWith("draft:") || callbackData?.startsWith("order:") || callbackData?.startsWith("barista:") || callbackData === "service:orders:mine") return;

    if (callbackData === "service:order:create") {
      await handleCreateOrderCallback(
        {
          from: ctx.from,
          session: ctx.session,
          callbackId: ctx.callbackQuery.id,
          callbackData,
          reply: (message, extra) => ctx.reply(message, extra),
          answerCallback: (message) => ctx.answerCbQuery(message),
          clearCallbackMessage: () => ctx.editMessageReplyMarkup({ inline_keyboard: [] }),
        },
        api,
      );
      return;
    }

    await handleCallback(
      {
        from: ctx.from,
        session: ctx.session,
        callbackId: ctx.callbackQuery.id,
        callbackData,
        reply: (message, extra) => ctx.reply(message, extra),
        answerCallback: (message) => ctx.answerCbQuery(message),
        clearCallbackMessage: () => ctx.editMessageReplyMarkup({ inline_keyboard: [] }),
      },
      api,
    );
  });
}
