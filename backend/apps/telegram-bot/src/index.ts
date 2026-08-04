import { createBot } from "./bot.js";
import { getBotConfig } from "./config/env.js";

const config = getBotConfig();
const bot = createBot(config);

async function start(): Promise<void> {
  if (config.webhook) {
    await bot.launch({
      webhook: {
        domain: config.webhook.domain,
        hookPath: config.webhook.path,
        port: config.webhook.port,
      },
    });
    console.info(`Telegram bot listening for webhooks on ${config.webhook.path}`);
  } else {
    await bot.launch();
    console.info("Telegram bot started with long polling");
  }
}

void start();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
