import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/telegram-bot/src/**/*.test.ts"],
  },
});
