export interface BotConfig {
  telegramBotToken: string;
  apiBaseUrl: string;
  botInternalSecret: string;
  webhook?: {
    domain: string;
    path: string;
    port: number;
    secretToken: string;
  };
}

export interface NotificationWorkerConfig {
  telegramBotToken: string;
  redisUrl: string;
  databaseUrl: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function httpUrl(name: string, value: string, protocols: string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}`);
  }
  return parsed;
}

function webhookSecret(): string {
  const secret = required("TELEGRAM_WEBHOOK_SECRET_TOKEN");
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET_TOKEN must contain only A-Z, a-z, 0-9, _ or - (max 256 characters)");
  }
  return secret;
}

export function getBotConfig(): BotConfig {
  const domainValue = process.env.TELEGRAM_WEBHOOK_DOMAIN?.trim();
  const port = Number(process.env.PORT?.trim() || 3001);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  const apiBaseUrl = httpUrl("API_BASE_URL", required("API_BASE_URL"), ["http:", "https:"]);
  const webhookDomain = domainValue ? httpUrl("TELEGRAM_WEBHOOK_DOMAIN", domainValue, ["https:"]) : undefined;
  if (webhookDomain && (webhookDomain.pathname !== "/" || webhookDomain.search || webhookDomain.hash)) {
    throw new Error("TELEGRAM_WEBHOOK_DOMAIN must be an HTTPS origin without a path, query or fragment");
  }

  const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH?.trim() || "/telegram/webhook";
  if (!webhookPath.startsWith("/") || webhookPath.includes("?") || webhookPath.includes("#")) {
    throw new Error("TELEGRAM_WEBHOOK_PATH must start with / and cannot contain a query or fragment");
  }

  return {
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ""),
    botInternalSecret: required("BOT_INTERNAL_SECRET"),
    webhook: webhookDomain
      ? { domain: webhookDomain.origin, path: webhookPath, port, secretToken: webhookSecret() }
      : undefined,
  };
}

export function getNotificationWorkerConfig(): NotificationWorkerConfig {
  return {
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    redisUrl: required("REDIS_URL"),
    databaseUrl: required("DATABASE_URL"),
  };
}
