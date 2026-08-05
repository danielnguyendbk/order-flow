import { Telegraf, session } from "telegraf";

import { BackendClient } from "./api/backend-client.js";
import { getBotConfig, type BotConfig } from "./config/env.js";
import { registerCallbackHandlers } from "./handlers/callback.handler.js";
import { registerDraftOrderHandlers } from "./handlers/draft-order.handler.js";
import { registerOrderStatusHandlers } from "./handlers/order-status.handler.js";
import { registerStartHandler } from "./handlers/start.handler.js";
import type { BotContext, BotSession } from "./types.js";

/**
 * Builds the Telegram boundary only. Domain rules remain in the API so every
 * state-changing action is authorised and validated by the backend.
 */
export function createBot(config: BotConfig = getBotConfig()) {
  const bot = new Telegraf<BotContext>(config.telegramBotToken);
  const api = new BackendClient(config.apiBaseUrl, config.botInternalSecret);

  bot.use(session<BotSession, BotContext>({ defaultSession: () => ({}) }));
  registerStartHandler(bot, api);
  registerDraftOrderHandlers(bot, api);
  registerOrderStatusHandlers(bot, api);
  registerCallbackHandlers(bot, api);

  bot.catch((error, ctx) => {
    console.error("Telegram update failed", {
      error,
      updateId: ctx.update.update_id,
    });
  });

  return bot;
}

