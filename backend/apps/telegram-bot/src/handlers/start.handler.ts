import type { Telegraf } from "telegraf";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import { authenticateEmployee, type EmployeeAuthenticationApi, MissingTelegramIdentityError } from "../auth/employee-auth.js";
import { roleMenu } from "../keyboards/role-menu.js";
import type { BotContext, BotSession } from "../types.js";

const ACCESS_DENIED_MESSAGE = "Tài khoản Telegram của bạn chưa được đăng ký hoặc đã bị vô hiệu hóa.";
const IDENTITY_MISSING_MESSAGE = "Không xác định được tài khoản Telegram của bạn.";
const SERVICE_UNAVAILABLE_MESSAGE = "Không thể kết nối hệ thống. Hãy thử lại sau.";

export interface StartHandlerContext {
  from?: { id: number };
  session: BotSession;
  reply(message: string, extra?: ReturnType<typeof roleMenu>): Promise<unknown>;
}

export function isAccessDenied(error: unknown): boolean {
  return error instanceof BackendApiError && [401, 403, 404].includes(error.status);
}

export async function handleStart(ctx: StartHandlerContext, api: EmployeeAuthenticationApi): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    await ctx.reply(`Chào ${employee.displayName}.`, roleMenu(employee.role));
  } catch (error) {
    if (error instanceof MissingTelegramIdentityError) {
      await ctx.reply(IDENTITY_MISSING_MESSAGE);
      return;
    }

    await ctx.reply(isAccessDenied(error) ? ACCESS_DENIED_MESSAGE : SERVICE_UNAVAILABLE_MESSAGE);
  }
}

export function registerStartHandler(bot: Telegraf<BotContext>, api: BackendApi): void {
  bot.start((ctx) => handleStart(ctx, api));
}
