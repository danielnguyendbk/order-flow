import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaTelegramEmployeeRepository } from "../telegram-session.repository";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const database = testDatabaseUrl
  ? new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } })
  : undefined;

describe.skipIf(!database)("Telegram employee repository database integration", () => {
  afterAll(async () => database?.$disconnect());

  it("queries public.users with a parameterized Telegram ID", async () => {
    const repository = new PrismaTelegramEmployeeRepository(database!);
    const result = await repository.findByTelegramUserId(Number.MAX_SAFE_INTEGER);
    if (result) expect(result.telegramUserId).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  });
});
