import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import { isAccessDenied } from "./start.handler.js";
import type { BotContext, BotSession, EmployeeRole } from "../types.js";

type CallbackAction = {
  role: EmployeeRole;
  message: string;
};

const actions: Record<string, CallbackAction> = {
  "service:order:create": { role: "SERVICE_STAFF", message: "Luồng tạo đơn đang được hoàn thiện." },
  "service:orders:mine": { role: "SERVICE_STAFF", message: "Danh sách đơn đang được hoàn thiện." },
  "barista:queue": { role: "BARISTA", message: "Hàng đợi pha chế đang được hoàn thiện." },
  "barista:orders:mine": { role: "BARISTA", message: "Lịch sử pha chế đang được hoàn thiện." },
};

export interface CallbackHandlerContext {
  from?: { id: number };
  session: BotSession;
  callbackId: string;
  callbackData?: string;
  reply(message: string): Promise<unknown>;
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

export async function handleCallback(ctx: CallbackHandlerContext, api: BackendApi): Promise<void> {
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
    await ctx.reply(action.message);
  } catch (error) {
    await ctx.answerCallback(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : "Không thể xử lý. Hãy thử lại.");
  } finally {
    releaseCallback(ctx, actionKey);
  }
}

export function registerCallbackHandlers(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.on("callback_query", async (ctx) => {
    const callbackData = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    await handleCallback(
      {
        from: ctx.from,
        session: ctx.session,
        callbackId: ctx.callbackQuery.id,
        callbackData,
        reply: (message) => ctx.reply(message),
        answerCallback: (message) => ctx.answerCbQuery(message),
      },
      api,
    );
  });
}
