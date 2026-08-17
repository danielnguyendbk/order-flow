import type { Telegraf } from "telegraf";

import type { BackendApi } from "../api/backend-client.js";
import { authenticateEmployee } from "../auth/employee-auth.js";
import type { BotContext, BotSession } from "../types.js";
import { startDraftOrder } from "./draft-order.handler.js";
import { isAccessDenied } from "./start.handler.js";

export interface VoiceOrderIntakeInput {
  audioUrl: string;
  telegramUserId: number;
}

export interface VoiceOrderIntakeResult {
  transcript: string;
}

export interface VoiceOrderIntake {
  createDraftFromVoice(input: VoiceOrderIntakeInput): Promise<VoiceOrderIntakeResult>;
}

export interface VoiceOrderContext {
  from?: { id: number };
  session: BotSession;
  voiceFileId: string;
  getVoiceFileUrl(fileId: string): Promise<URL>;
  reply(message: string, extra?: unknown): Promise<unknown>;
}

const FAILURE_MESSAGE = "Không thể tạo đơn từ tin nhắn thoại. Vui lòng thử lại hoặc nhập đơn bằng nút Tạo đơn.";

export async function handleVoiceOrder(
  ctx: VoiceOrderContext,
  api: BackendApi,
  intake: VoiceOrderIntake,
): Promise<void> {
  try {
    const employee = await authenticateEmployee(ctx, api);
    if (employee.role !== "SERVICE_STAFF") {
      await ctx.reply("Bạn không có quyền tạo đơn.");
      return;
    }

    const audioUrl = await ctx.getVoiceFileUrl(ctx.voiceFileId);
    await intake.createDraftFromVoice({
      audioUrl: audioUrl.toString(),
      telegramUserId: employee.telegramUserId,
    });
    await startDraftOrder(ctx, api, employee);
  } catch (error) {
    await ctx.reply(isAccessDenied(error) ? "Tài khoản không còn được phép sử dụng." : FAILURE_MESSAGE);
  }
}

export function registerVoiceOrderHandler(
  bot: Telegraf<BotContext>,
  api: BackendApi,
  intake: VoiceOrderIntake,
): void {
  bot.on("voice", async (ctx) => {
    await handleVoiceOrder(
      {
        from: ctx.from,
        session: ctx.session,
        voiceFileId: ctx.message.voice.file_id,
        getVoiceFileUrl: (fileId) => ctx.telegram.getFileLink(fileId),
        reply: (message, extra) => ctx.reply(message, extra as never),
      },
      api,
      intake,
    );
  });
}
