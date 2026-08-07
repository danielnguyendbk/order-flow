import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "../../core/errors.js";
import type { TelegramIdentity } from "./auth.types.js";

interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramIdentity {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash || !/^[a-f\d]{64}$/i.test(receivedHash)) {
    throw new AppError("INVALID_TELEGRAM_DATA", "Invalid Telegram signature");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const providedHash = Buffer.from(receivedHash, "hex");

  if (
    providedHash.length !== expectedHash.length ||
    !timingSafeEqual(providedHash, expectedHash)
  ) {
    throw new AppError("INVALID_TELEGRAM_DATA", "Invalid Telegram signature");
  }

  const authDate = Number(params.get("auth_date"));
  if (
    !Number.isInteger(authDate) ||
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > maxAgeSeconds
  ) {
    throw new AppError("INVALID_TELEGRAM_DATA", "Telegram session data has expired");
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    throw new AppError("INVALID_TELEGRAM_DATA", "Telegram user data is missing");
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(rawUser) as TelegramWebAppUser;
  } catch {
    throw new AppError("INVALID_TELEGRAM_DATA", "Telegram user data is invalid");
  }

  if (!Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new AppError("INVALID_TELEGRAM_DATA", "Telegram user ID is invalid");
  }

  return {
    id: String(user.id),
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    authDate,
  };
}
