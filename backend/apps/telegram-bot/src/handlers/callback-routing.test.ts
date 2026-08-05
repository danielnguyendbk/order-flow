import { Telegraf, Telegram } from "telegraf";
import { describe, expect, it, vi } from "vitest";

import type { BackendApi } from "../api/backend-client.js";
import { draftCallbackData } from "../callbacks/callback-data.js";
import type { BotContext } from "../types.js";
import { registerDraftOrderHandlers } from "./draft-order.handler.js";

describe("Telegraf callback routing", () => {
  it("passes the full callback_data payload to the draft handler", async () => {
    const categoryId = "00000000-0000-0000-0000-000000000029";
    const api = {
      createTelegramSession: vi.fn().mockResolvedValue({
        employeeId: "employee-1",
        telegramUserId: 2900,
        displayName: "Khoa",
        role: "SERVICE_STAFF",
      }),
      getMenuCategories: vi.fn().mockResolvedValue([{ id: categoryId, name: "Tea" }]),
      getMenuItems: vi.fn().mockResolvedValue([]),
    } as unknown as BackendApi;
    const bot = new Telegraf<BotContext>("123456:TEST_TOKEN");
    bot.botInfo = { id: 123456, is_bot: true, first_name: "Test", username: "test_bot" };
    bot.use((ctx, next) => {
      ctx.session = { draftOrder: { orderId: "order-1", step: "CATEGORY", callbackRevision: "deadbeef" } };
      return next();
    });
    registerDraftOrderHandlers(bot, api);
    vi.spyOn(Telegram.prototype, "callApi").mockResolvedValue(true as never);

    await bot.handleUpdate({
      update_id: 29,
      callback_query: {
        id: "callback-29",
        chat_instance: "chat-instance",
        data: draftCallbackData("deadbeef", "category", categoryId),
        from: { id: 2900, is_bot: false, first_name: "Khoa" },
        message: {
          message_id: 1,
          date: 1_700_000_000,
          chat: { id: 2900, type: "private", first_name: "Khoa" },
        },
      },
    });

    expect(api.getMenuItems).toHaveBeenCalledWith(2900, categoryId);
  });
});
