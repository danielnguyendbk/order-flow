import { createBot } from "./bot.js";
import { getBotConfig } from "./config/env.js";
import { launchBot } from "./runtime.js";

const config = getBotConfig();
const bot = createBot(config);

void launchBot(bot, config).catch((error: unknown) => {
  console.error("Telegram bot failed to start", error);
  process.exitCode = 1;
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
