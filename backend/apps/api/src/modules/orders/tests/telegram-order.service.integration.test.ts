import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TelegramOrderService } from "../telegram-order.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL");
}

const database = testDatabaseUrl
  ? new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } })
  : undefined;

describe.skipIf(!database)("Telegram order disposable-database integration", () => {
  let employeeId = "";
  let otherEmployeeId = "";
  let categoryId = "";
  let menuItemId = "";
  const service = database
    ? new TelegramOrderService(database, { accountNumber: "123456789", bankName: "MB", accountHolder: "ORDER FLOW" })
    : undefined;

  beforeAll(async () => {
    const suffix = Date.now().toString();
    const employee = await database!.user.create({
      data: { fullName: "Telegram Test Staff", telegramUserId: BigInt(`91${suffix.slice(-7)}`), role: "SERVICE_STAFF" },
    });
    const other = await database!.user.create({
      data: { fullName: "Other Test Staff", telegramUserId: BigInt(`92${suffix.slice(-7)}`), role: "SERVICE_STAFF" },
    });
    const category = await database!.menuCategory.create({ data: { name: `Test Category ${suffix}` } });
    const item = await database!.menuItem.create({
      data: { categoryId: category.id, name: `Test Item ${suffix}`, price: 25_000n },
    });
    employeeId = employee.id;
    otherEmployeeId = other.id;
    categoryId = category.id;
    menuItemId = item.id;
  });

  afterAll(async () => {
    if (!database) return;
    if (employeeId || otherEmployeeId) {
      const ownerIds = [employeeId, otherEmployeeId].filter(Boolean);
      const orders = await database.order.findMany({ where: { createdByUserId: { in: ownerIds } }, select: { id: true } });
      const orderIds = orders.map((order) => order.id);
      await database.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (menuItemId) await database.menuItem.deleteMany({ where: { id: menuItemId } });
    if (categoryId) await database.menuCategory.deleteMany({ where: { id: categoryId } });
    await database.user.deleteMany({ where: { id: { in: [employeeId, otherEmployeeId].filter(Boolean) } } });
    await database.$disconnect();
  });

  it("uses database price, enforces ownership and confirms CASH idempotently", async () => {
    const [draft, repeatedDraft] = await Promise.all([
      service!.createDraft(employeeId),
      service!.createDraft(employeeId),
    ]);
    expect(repeatedDraft.id).toBe(draft.id);
    expect(await database!.order.count({
      where: { createdByUserId: employeeId, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT" },
    })).toBe(1);
    const withItem = await service!.addItem(employeeId, draft.id, { menuItemId, quantity: 2, note: "Ít đá" });
    expect(withItem.totalAmount).toBe(50_000);
    expect(withItem.items[0]).toMatchObject({ unitPrice: 25_000, quantity: 2, note: "Ít đá" });
    await expect(service!.getOrder(otherEmployeeId, draft.id)).rejects.toMatchObject({ code: "ORDER_FORBIDDEN" });

    const paid = await service!.confirmCash(employeeId, draft.id);
    const repeated = await service!.confirmCash(employeeId, draft.id);
    expect(paid).toMatchObject({ paymentMethod: "CASH", paymentStatus: "PAID", fulfillmentStatus: "QUEUED" });
    expect(repeated).toMatchObject({ paymentStatus: "PAID", fulfillmentStatus: "QUEUED" });
    expect(await database!.orderStatusHistory.count({ where: { orderId: draft.id } })).toBe(3);
  });

  it("creates an idempotent QR payment and exposes it through mine/status", async () => {
    const draft = await service!.createDraft(employeeId);
    await service!.addItem(employeeId, draft.id, { menuItemId, quantity: 1 });
    const first = await service!.createQr(employeeId, draft.id);
    const repeated = await service!.createQr(employeeId, draft.id);
    expect(first.order).toMatchObject({ paymentMethod: "QR", paymentStatus: "PENDING", fulfillmentStatus: "PENDING_PAYMENT" });
    expect(repeated.paymentCode).toBe(first.paymentCode);
    expect(new URL(first.qrImageUrl).searchParams.get("amount")).toBe("25000");
    await expect(service!.confirmCash(employeeId, draft.id)).rejects.toMatchObject({ code: "PAYMENT_METHOD_CONFLICT" });
    expect((await service!.listMine(employeeId)).some((order) => order.id === draft.id)).toBe(true);
    expect(await service!.getOrder(employeeId, draft.id)).toMatchObject({ paymentStatus: "PENDING" });
  });
});
