import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { AppError } from "../src/core/errors.js";
import { verifyTelegramInitData } from "../src/modules/auth/telegram-init-data.js";

const botToken = "123456:test-bot-token";
const now = 1_750_000_000;

function signedInitData(overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    auth_date: String(now),
    query_id: "test-query",
    user: JSON.stringify({
      id: 123456789,
      username: "barista_one",
      first_name: "Barista",
    }),
    ...overrides,
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

test("verifies signed Telegram Web App data", () => {
  const identity = verifyTelegramInitData(signedInitData(), botToken, 300, now);
  assert.deepEqual(identity, {
    id: "123456789",
    username: "barista_one",
    firstName: "Barista",
    lastName: undefined,
    authDate: now,
  });
});

test("rejects tampered Telegram Web App data", () => {
  const initData = signedInitData().replace("barista_one", "attacker");
  assert.throws(
    () => verifyTelegramInitData(initData, botToken, 300, now),
    (error) => error instanceof AppError && error.code === "INVALID_TELEGRAM_DATA",
  );
});

test("rejects expired Telegram Web App data", () => {
  assert.throws(
    () => verifyTelegramInitData(signedInitData(), botToken, 300, now + 301),
    (error) => error instanceof AppError && error.code === "INVALID_TELEGRAM_DATA",
  );
});
