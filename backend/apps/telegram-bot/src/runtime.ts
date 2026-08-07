import type { Telegraf } from "telegraf";

import type { BotConfig } from "./config/env.js";
import type { BotContext } from "./types.js";

export async function launchBot(bot: Telegraf<BotContext>, config: BotConfig): Promise<void> {
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
