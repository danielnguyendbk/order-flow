import { describe, expect, it, vi } from "vitest";
import type { Telegraf } from "telegraf";

import type { BotConfig } from "./config/env.js";
import { BOT_COMMANDS, launchBot } from "./runtime.js";
import type { BotContext } from "./types.js";

const pollingConfig: BotConfig = {
  telegramBotToken: "test-token",
  apiBaseUrl: "http://localhost:3000/api/v1",
  botInternalSecret: "test-secret",
};

function botWithLaunch(
  launch: ReturnType<typeof vi.fn>,
  setMyCommands = vi.fn().mockResolvedValue(true),
  setChatMenuButton = vi.fn().mockResolvedValue(true),
): Telegraf<BotContext> {
  return { launch, telegram: { setMyCommands, setChatMenuButton } } as unknown as Telegraf<BotContext>;
}

describe("Telegram bot launcher", () => {
  it("starts with long polling when webhook configuration is absent", async () => {
    const launch = vi.fn().mockResolvedValue(undefined);
    const setMyCommands = vi.fn().mockResolvedValue(true);
    const setChatMenuButton = vi.fn().mockResolvedValue(true);

    await launchBot(botWithLaunch(launch, setMyCommands, setChatMenuButton), pollingConfig);

    expect(setMyCommands).toHaveBeenCalledWith(BOT_COMMANDS);
    expect(BOT_COMMANDS).toEqual(expect.arrayContaining([
      { command: "queue", description: "Xem hàng đợi pha chế" },
      { command: "brewing", description: "Xem đơn đang pha" },
      { command: "baristaorders", description: "Xem các đơn đã nhận" },
    ]));
    expect(setChatMenuButton).toHaveBeenCalledWith({ menuButton: { type: "commands" } });
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
