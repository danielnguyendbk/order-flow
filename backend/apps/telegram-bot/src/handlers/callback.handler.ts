import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee, type EmployeeAuthenticationApi } from "../auth/employee-auth.js";
import { startDraftOrder } from "./draft-order.handler.js";
import { isAccessDenied } from "./start.handler.js";
import type { BotContext, BotSession, EmployeeRole } from "../types.js";

type CallbackAction = {
  role: EmployeeRole;
  message?: string;
};

const actions: Record<string, CallbackAction> = {
  "service:order:create": { role: "SERVICE_STAFF" },
  "barista:queue": { role: "BARISTA", message: "Hàng đợi pha chế đang được hoàn thiện." },
  "barista:orders:mine": { role: "BARISTA", message: "Lịch sử pha chế đang được hoàn thiện." },
};

export interface CallbackHandlerContext {
  from?: { id: number };
  session: BotSession;
  callbackId: string;
  callbackData?: string;
  reply(message: string, extra?: object): Promise<unknown>;
  answerCallback(message?: string): Promise<unknown>;
}

function acquireCallback(ctx: CallbackHandlerContext, actionKey: string): boolean {
  const pending = new Set(ctx.session.pendingCallbacks ?? []);
  if (pending.has(actionKey)) return false;
  pending.add(actionKey);
  ctx.session.pendingCallbacks = [...pending];
  return true;
}

function releaseCallback(ctx: CallbackHandlerContext, actionKey: string): void {
  ctx.session.pendingCallbacks = (ctx.session.pendingCallbacks ?? []).filter((id) => id !== actionKey);
}

export async function handleCallback(ctx: CallbackHandlerContext, api: EmployeeAuthenticationApi): Promise<void> {
  const actionKey = ctx.callbackData ?? ctx.callbackId;
  if (!ctx.callbackData || !acquireCallback(ctx, actionKey)) {
    await ctx.answerCallback("Yêu cầu này đang được xử lý.");
    return;
  }

  try {
    const employee = await authenticateEmployee(ctx, api);
    const action = actions[ctx.callbackData];
    if (!action || employee.role !== action.role) {
      await ctx.answerCallback("Thao tác không còn hợp lệ.");
      return;
    }

    await ctx.answerCallback();
    if (action.message) await ctx.reply(action.message);
  } catch (error) {
    await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý. Hãy thử lại.");
  } finally {
    releaseCallback(ctx, actionKey);
  }
}

export function registerCallbackHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.on("callback_query", async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    if (callbackData?.startsWith("draft:") || callbackData?.startsWith("order:") || callbackData === "service:orders:mine") return;

    if (callbackData === "service:order:create") {
      await ctx.answerCbQuery();
      await startDraftOrder(
        {
          from: ctx.from,
          session: ctx.session,
          reply: (message, extra) => ctx.reply(message, extra),
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
      },
      api,
    );
  });
}
