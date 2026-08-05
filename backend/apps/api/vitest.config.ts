import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/modules/auth/tests/**/*.test.ts"],
    exclude: ["src/modules/auth/tests/**/*.integration.test.ts"],
  },
});
