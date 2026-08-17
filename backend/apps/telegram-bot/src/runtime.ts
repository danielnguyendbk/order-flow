import type { Telegraf } from "telegraf";

import type { BotConfig } from "./config/env.js";
import type { BotContext } from "./types.js";

export const BOT_COMMANDS = [
  { command: "order", description: "Tạo hoặc tiếp tục đơn" },
  { command: "cart", description: "Xem đơn đang tạo" },
  { command: "orders", description: "Xem các đơn gần đây" },
  { command: "status", description: "Kiểm tra trạng thái đơn" },
  { command: "menu", description: "Hiện bàn phím thao tác nhanh" },
  { command: "help", description: "Xem các thao tác hỗ trợ" },
  { command: "queue", description: "Xem hàng đợi pha chế" },
  { command: "brewing", description: "Xem đơn đang pha" },
  { command: "baristaorders", description: "Xem các đơn đã nhận" },
] as const;

export async function launchBot(bot: Telegraf<BotContext>, config: BotConfig): Promise<void> {
  await bot.telegram.setMyCommands(BOT_COMMANDS);
  await bot.telegram.setChatMenuButton({ menuButton: { type: "commands" } });

  if (config.webhook) {
    await bot.launch(
      {
        webhook: {
          domain: config.webhook.domain,
          path: config.webhook.path,
          port: config.webhook.port,
          secretToken: config.webhook.secretToken,
        },
      },
      () => console.info(`Telegram bot starting in webhook mode on ${config.webhook?.path}`),
    );
    return;
  }

  await bot.launch(() => console.info("Telegram bot starting with long polling"));
}
