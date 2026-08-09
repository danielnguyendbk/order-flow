import { afterEach, describe, expect, it, vi } from "vitest";

import { parseLocalEnvironment } from "./local-env.js";

afterEach(() => vi.unstubAllEnvs());

describe("local Telegram environment", () => {
  it("parses quoted, unquoted and empty values while ignoring comments", () => {
    expect(parseLocalEnvironment([
      "# local settings",
      "TELEGRAM_BOT_TOKEN=new-token",
      'BOT_INTERNAL_SECRET="new secret"',
      "TELEGRAM_WEBHOOK_DOMAIN=",
      "invalid key=value",
    ].join("\n"))).toEqual({
      TELEGRAM_BOT_TOKEN: "new-token",
      BOT_INTERNAL_SECRET: "new secret",
      TELEGRAM_WEBHOOK_DOMAIN: "",
    });
  });
});
