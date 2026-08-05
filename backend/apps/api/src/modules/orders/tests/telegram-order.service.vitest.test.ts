import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { TelegramOrderService } from "../telegram-order.service";

const unusedDatabase = {} as PrismaClient;

describe("TelegramOrderService input guards", () => {
  it("rejects client quantities outside the Telegram contract before database access", async () => {
    const service = new TelegramOrderService(unusedDatabase);
    await expect(service.addItem("employee", "order", { menuItemId: "item", quantity: 0 })).rejects.toMatchObject({ code: "QUANTITY_INVALID" });
    await expect(service.addItem("employee", "order", { menuItemId: "item", quantity: 100 })).rejects.toMatchObject({ code: "QUANTITY_INVALID" });
  });

  it("rejects an empty item update before database access", async () => {
    const service = new TelegramOrderService(unusedDatabase);
    await expect(service.updateItem("employee", "order", "item", {})).rejects.toMatchObject({ code: "ITEM_UPDATE_EMPTY" });
  });

  it("fails QR creation explicitly when bank configuration is missing", async () => {
    const service = new TelegramOrderService(unusedDatabase, { accountNumber: "", bankName: "" });
    await expect(service.createQr("employee", "order")).rejects.toMatchObject({ statusCode: 503, code: "QR_CONFIG_MISSING" });
  });
});
