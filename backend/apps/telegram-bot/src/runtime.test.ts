import { describe, expect, it, vi } from "vitest";
import type { Telegraf } from "telegraf";

import type { BotConfig } from "./config/env.js";
import { launchBot } from "./runtime.js";
import type { BotContext } from "./types.js";

const pollingConfig: BotConfig = {
  telegramBotToken: "test-token",
  apiBaseUrl: "http://localhost:3000/api/v1",
  botInternalSecret: "test-secret",
};

function botWithLaunch(launch: ReturnType<typeof vi.fn>): Telegraf<BotContext> {
  return { launch } as unknown as Telegraf<BotContext>;
}

describe("Telegram bot launcher", () => {
  it("starts with long polling when webhook configuration is absent", async () => {
    const launch = vi.fn().mockResolvedValue(undefined);

    await launchBot(botWithLaunch(launch), pollingConfig);

    expect(launch).toHaveBeenCalledOnce();
    expect(launch.mock.calls[0]).toHaveLength(1);
    expect(launch.mock.calls[0][0]).toBeTypeOf("function");
  });

  it("passes production webhook settings to Telegraf", async () => {
    const launch = vi.fn().mockResolvedValue(undefined);

    await launchBot(botWithLaunch(launch), {
      ...pollingConfig,
      webhook: {
        domain: "https://bot.example.com",
        path: "/telegram/update",
        port: 8443,
        secretToken: "webhook-secret",
      },
    });

    expect(launch).toHaveBeenCalledWith(
      {
        webhook: {
          domain: "https://bot.example.com",
          path: "/telegram/update",
          port: 8443,
          secretToken: "webhook-secret",
        },
      },
      expect.any(Function),
    );
  });
});
