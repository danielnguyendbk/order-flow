import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/modules/auth/tests/**/*.test.ts",
      "src/modules/orders/tests/**/*.vitest.test.ts",
      "src/modules/barista/tests/**/*.test.ts",
      "src/modules/notifications/tests/**/*.test.ts",
    ],
    exclude: ["src/modules/**/tests/**/*.integration.test.ts"],
  },
});
