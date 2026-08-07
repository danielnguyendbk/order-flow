import { describe, expect, it } from "vitest";

import {
  assertTelegramCallbackData,
  draftCallbackData,
  parseDraftCallbackData,
  TELEGRAM_CALLBACK_DATA_MAX_BYTES,
  type DraftCallbackAction,
} from "./callback-data.js";

describe("Telegram callback data protocol", () => {
  it.each([
    ["category", "00000000-0000-0000-0000-000000000001"],
    ["item", "00000000-0000-0000-0000-000000000002"],
    ["edit", "00000000-0000-0000-0000-000000000003"],
    ["editQuantity", "00000000-0000-0000-0000-000000000004"],
    ["editNote", "00000000-0000-0000-0000-000000000005"],
    ["delete", "00000000-0000-0000-0000-000000000006"],
    ["cancel", undefined],
    ["addMore", undefined],
    ["backCategories", undefined],
    ["backReview", undefined],
    ["skipNote", undefined],
    ["payCash", undefined],
    ["payQr", undefined],
  ] satisfies Array<[DraftCallbackAction, string | undefined]>)
  ("round-trips %s within Telegram's 64-byte limit", (action, entityId) => {
    const data = draftCallbackData("deadbeef", action, entityId);

    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(TELEGRAM_CALLBACK_DATA_MAX_BYTES);
    expect(parseDraftCallbackData(data)).toEqual({ revision: "deadbeef", action, ...(entityId ? { entityId } : {}) });
  });

  it("rejects legacy, malformed and oversized callback data", () => {
    expect(parseDraftCallbackData("draft:pay:cash")).toBeUndefined();
    expect(parseDraftCallbackData("d:deadbeef:c")).toBeUndefined();
    expect(() => assertTelegramCallbackData(`d:deadbeef:i:${"x".repeat(60)}`)).toThrow(/64 bytes/);
  });
});
