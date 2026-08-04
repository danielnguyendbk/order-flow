export interface BotConfig {
  telegramBotToken: string;
  apiBaseUrl: string;
  botInternalSecret: string;
  redisUrl: string;
  webhook?: {
    domain: string;
    path: string;
    port: number;
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getBotConfig(): BotConfig {
  const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN?.trim();
  const port = Number(process.env.PORT ?? 3001);

  if (!Number.isInteger(port) || port <= 0) throw new Error("PORT must be a positive integer");

  return {
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    apiBaseUrl: required("API_BASE_URL").replace(/\/$/, ""),
    botInternalSecret: required("BOT_INTERNAL_SECRET"),
    redisUrl: required("REDIS_URL"),
    webhook: domain
      ? { domain: domain.replace(/\/$/, ""), path: process.env.TELEGRAM_WEBHOOK_PATH ?? "/telegram/webhook", port }
      : undefined,
  };
}
