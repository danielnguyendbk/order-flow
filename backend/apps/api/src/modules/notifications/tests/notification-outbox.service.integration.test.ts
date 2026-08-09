import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { recordPaymentReviewNotifications } from "../notification-outbox.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL");
}

const database = testDatabaseUrl
  ? new PrismaClient({ datasourceUrl: testDatabaseUrl })
  : undefined;

describe.skipIf(!database)("notification outbox disposable-database integration", () => {
  const ownerIds: string[] = [];
  const sourceKey = `sepay-replay-${Date.now()}`;

  beforeAll(async () => {
    const suffix = Date.now().toString();
    const owners = await Promise.all([
      database!.user.create({ data: {
        fullName: "Notification Test Owner One",
        telegramUserId: BigInt(`71${suffix.slice(-7)}`),
        telegramChatId: BigInt(`71${suffix.slice(-7)}`),
        username: `notification-owner-one-${suffix}`,
        passwordHash: "integration-test-only",
        role: "OWNER",
      } }),
      database!.user.create({ data: {
        fullName: "Notification Test Owner Two",
        telegramUserId: BigInt(`72${suffix.slice(-7)}`),
        username: `notification-owner-two-${suffix}`,
        passwordHash: "integration-test-only",
        role: "OWNER",
      } }),
    ]);
    ownerIds.push(...owners.map((owner) => owner.id));
  });

  afterAll(async () => {
    if (!database) return;
    await database.notification.deleteMany({ where: { sourceKey } });
    await database.user.deleteMany({ where: { id: { in: ownerIds } } });
    await database.$disconnect();
  });

  it("does not create duplicate PAYMENT_REVIEW notifications when a source event is replayed", async () => {
    const firstCount = await database!.$transaction((tx) => recordPaymentReviewNotifications(tx, { sourceKey }));
    const replayCount = await database!.$transaction((tx) => recordPaymentReviewNotifications(tx, { sourceKey }));

    expect(firstCount).toBe(2);
    expect(replayCount).toBe(0);
    expect(await database!.notification.count({
      where: { event: "PAYMENT_REVIEW", sourceKey, recipientUserId: { in: ownerIds } },
    })).toBe(2);
  });
});
