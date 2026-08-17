import { afterEach, describe, expect, it, vi } from "vitest";

import { getBotConfig, getNotificationWorkerConfig } from "./env.js";

const relevantVariables = [
  "TELEGRAM_BOT_TOKEN",
  "API_BASE_URL",
  "BOT_INTERNAL_SECRET",
  "REDIS_URL",
  "DATABASE_URL",
  "NOTIFICATION_NOT_BEFORE",
  "TELEGRAM_WEBHOOK_DOMAIN",
  "TELEGRAM_WEBHOOK_PATH",
  "TELEGRAM_WEBHOOK_SECRET_TOKEN",
  "PORT",
  "VOICE_ORDER_PYTHON",
  "VOICE_ORDER_SCRIPT",
  "VOICE_ORDER_TIMEOUT_MS",
] as const;

function baseEnvironment(): void {
  for (const name of relevantVariables) vi.stubEnv(name, "");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("API_BASE_URL", "http://localhost:3000/api/v1/");
  vi.stubEnv("BOT_INTERNAL_SECRET", "test-secret");
}

afterEach(() => vi.unstubAllEnvs());

describe("Telegram bot environment", () => {
  it("uses polling configuration without requiring Redis", () => {
    baseEnvironment();

    expect(getBotConfig()).toEqual({
      telegramBotToken: "test-token",
      apiBaseUrl: "http://localhost:3000/api/v1",
      botInternalSecret: "test-secret",
      webhook: undefined,
    });
  });

  it("configures the optional voice-order bridge", () => {
    baseEnvironment();
    vi.stubEnv("VOICE_ORDER_PYTHON", "/opt/hermes/python");
    vi.stubEnv("VOICE_ORDER_SCRIPT", "/opt/order-flow/voice_order_bridge.py");
    vi.stubEnv("VOICE_ORDER_TIMEOUT_MS", "180000");

    expect(getBotConfig().voiceOrder).toEqual({
      executable: "/opt/hermes/python",
      scriptPath: "/opt/order-flow/voice_order_bridge.py",
      timeoutMs: 180000,
    });
  });

  it("requires Redis only for the notification worker", () => {
    baseEnvironment();
    expect(() => getNotificationWorkerConfig()).toThrow("REDIS_URL is required");

    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    expect(() => getNotificationWorkerConfig()).toThrow("DATABASE_URL is required");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/order_flow");
    expect(getNotificationWorkerConfig()).toEqual({
      telegramBotToken: "test-token",
      redisUrl: "redis://localhost:6379",
      databaseUrl: "postgresql://localhost/order_flow",
    });
  });

  it("supports an optional notification cutoff and rejects invalid dates", () => {
    baseEnvironment();
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/order_flow");
    vi.stubEnv("NOTIFICATION_NOT_BEFORE", "2026-08-10T14:30:00.000Z");

    expect(getNotificationWorkerConfig().notificationNotBefore).toEqual(new Date("2026-08-10T14:30:00.000Z"));

    vi.stubEnv("NOTIFICATION_NOT_BEFORE", "not-a-date");
    expect(() => getNotificationWorkerConfig()).toThrow("NOTIFICATION_NOT_BEFORE must be a valid ISO date-time");
  });

  it("builds an authenticated production webhook configuration", () => {
    baseEnvironment();
    vi.stubEnv("TELEGRAM_WEBHOOK_DOMAIN", "https://bot.example.com/");
    vi.stubEnv("TELEGRAM_WEBHOOK_PATH", "/telegram/update");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN", "webhook_secret-123");
    vi.stubEnv("PORT", "8443");

    expect(getBotConfig().webhook).toEqual({
      domain: "https://bot.example.com",
      path: "/telegram/update",
      port: 8443,
      secretToken: "webhook_secret-123",
    });
  });

  it("requires a secret token when webhook mode is enabled", () => {
    baseEnvironment();
    vi.stubEnv("TELEGRAM_WEBHOOK_DOMAIN", "https://bot.example.com");

    expect(() => getBotConfig()).toThrow("TELEGRAM_WEBHOOK_SECRET_TOKEN is required");
  });

  it.each([
    ["API_BASE_URL", "not-a-url", "API_BASE_URL must be a valid URL"],
    ["TELEGRAM_WEBHOOK_DOMAIN", "http://bot.example.com", "TELEGRAM_WEBHOOK_DOMAIN must use https:"],
    ["TELEGRAM_WEBHOOK_PATH", "telegram/update", "TELEGRAM_WEBHOOK_PATH must start with /"],
    ["PORT", "70000", "PORT must be an integer from 1 to 65535"],
  ])("rejects invalid %s", (name, value, message) => {
    baseEnvironment();
    if (name !== "API_BASE_URL") {
      vi.stubEnv("TELEGRAM_WEBHOOK_DOMAIN", "https://bot.example.com");
      vi.stubEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN", "valid-secret");
    }
    vi.stubEnv(name, value);

    expect(() => getBotConfig()).toThrow(message);
  });
});
