import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/routes/**/*.test.ts",
      "src/modules/auth/tests/**/*.test.ts",
      "src/modules/payments/tests/**/*.test.ts",
      "src/modules/sepay/tests/**/*.test.ts",
      "src/modules/reconciliations/tests/**/*.test.ts",
      "src/modules/refunds/tests/**/*.test.ts",
      "src/modules/reports/tests/**/*.test.ts",
      "src/modules/orders/tests/**/*.vitest.test.ts",
      "src/modules/barista/tests/**/*.test.ts",
      "src/modules/admin/tests/**/*.test.ts",
      "src/modules/notifications/tests/**/*.test.ts",
      "src/jobs/**/*.test.ts",
    ],
    exclude: ["src/modules/**/tests/**/*.integration.test.ts"],
  },
});
