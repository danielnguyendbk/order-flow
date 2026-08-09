import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
<<<<<<< HEAD
    globals: true,
    environment: "node",
    include: ["apps/api/src/**/*.test.ts"],
=======
    include: [
      "src/modules/auth/tests/**/*.test.ts",
      "src/modules/orders/tests/**/*.vitest.test.ts",
      "src/modules/barista/tests/**/*.test.ts",
      "src/modules/admin/tests/**/*.test.ts",
      "src/modules/notifications/tests/**/*.test.ts",
    ],
    exclude: ["src/modules/**/tests/**/*.integration.test.ts"],
>>>>>>> origin/dev
  },
});
