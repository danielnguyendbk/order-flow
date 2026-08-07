import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TelegramBaristaService } from "../telegram-barista.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL");
}

const database = testDatabaseUrl
  ? new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } })
  : undefined;

describe.skipIf(!database)("Telegram barista disposable-database integration", () => {
  let staffId = "";
  let firstBaristaId = "";
  let secondBaristaId = "";
  let categoryId = "";
  let itemId = "";
  let orderId = "";
  const service = database ? new TelegramBaristaService(database) : undefined;

  beforeAll(async () => {
    const suffix = Date.now().toString();
    const [staff, firstBarista, secondBarista] = await Promise.all([
      database!.user.create({ data: { fullName: "Barista Test Staff", telegramUserId: BigInt(`81${suffix.slice(-7)}`), role: "SERVICE_STAFF" } }),
      database!.user.create({ data: { fullName: "First Test Barista", telegramUserId: BigInt(`82${suffix.slice(-7)}`), role: "BARISTA" } }),
      database!.user.create({ data: { fullName: "Second Test Barista", telegramUserId: BigInt(`83${suffix.slice(-7)}`), role: "BARISTA" } }),
    ]);
    staffId = staff.id;
    firstBaristaId = firstBarista.id;
    secondBaristaId = secondBarista.id;
    const category = await database!.menuCategory.create({ data: { name: `Barista Test Category ${suffix}` } });
    categoryId = category.id;
    const item = await database!.menuItem.create({ data: { categoryId, name: `Barista Test Item ${suffix}`, price: 40_000n } });
    itemId = item.id;
    const order = await database!.order.create({
      data: {
        orderCode: `BAR-${suffix}`,
        createdByUserId: staffId,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        fulfillmentStatus: "QUEUED",
        totalAmount: 40_000n,
        items: { create: { menuItemId: itemId, itemName: item.name, unitPrice: 40_000n, quantity: 1 } },
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (!database) return;
    if (orderId) {
      await database.notification.deleteMany({ where: { orderId } });
      await database.orderStatusHistory.deleteMany({ where: { orderId } });
      await database.orderItem.deleteMany({ where: { orderId } });
      await database.order.deleteMany({ where: { id: orderId } });
    }
    if (itemId) await database.menuItem.deleteMany({ where: { id: itemId } });
    if (categoryId) await database.menuCategory.deleteMany({ where: { id: categoryId } });
    await database.user.deleteMany({ where: { id: { in: [staffId, firstBaristaId, secondBaristaId].filter(Boolean) } } });
    await database.$disconnect();
  });

  it("allows exactly one concurrent claim and enforces READY ownership with history", async () => {
    expect((await service!.listQueue()).some((order) => order.id === orderId)).toBe(true);
    const claims = await Promise.allSettled([
      service!.claim(firstBaristaId, orderId),
      service!.claim(secondBaristaId, orderId),
    ]);
    expect(claims.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const claimed = await database!.order.findUniqueOrThrow({ where: { id: orderId } });
    const winner = claimed.assignedBaristaId!;
    const loser = winner === firstBaristaId ? secondBaristaId : firstBaristaId;
    expect(claimed.fulfillmentStatus).toBe("PREPARING");
    await expect(service!.markReady(loser, orderId)).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });
    expect(await service!.markReady(winner, orderId)).toMatchObject({ fulfillmentStatus: "READY", assignedBaristaId: winner });
    expect(await database!.orderStatusHistory.count({ where: { orderId, statusDomain: "FULFILLMENT" } })).toBe(2);
    expect(await database!.notification.count({
      where: { event: "ORDER_READY", sourceKey: orderId, recipientUserId: staffId },
    })).toBe(1);
  });
});
