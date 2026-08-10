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
  let secondMenuItemId = "";
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
    const secondItem = await database!.menuItem.create({
      data: { categoryId: category.id, name: `Test Item 2 ${suffix}`, price: 50_000n },
    });
    employeeId = employee.id;
    otherEmployeeId = other.id;
    categoryId = category.id;
    menuItemId = item.id;
    secondMenuItemId = secondItem.id;
  });

  afterAll(async () => {
    if (!database) return;
    if (employeeId || otherEmployeeId) {
      const ownerIds = [employeeId, otherEmployeeId].filter(Boolean);
      const orders = await database.order.findMany({ where: { createdByUserId: { in: ownerIds } }, select: { id: true } });
      const orderIds = orders.map((order) => order.id);
      await database.notification.deleteMany({ where: { recipientUserId: { in: ownerIds } } });
      await database.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await database.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (menuItemId) await database.menuItem.deleteMany({ where: { id: menuItemId } });
    if (secondMenuItemId) await database.menuItem.deleteMany({ where: { id: secondMenuItemId } });
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
    expect(await database!.notification.count({
      where: { event: "ORDER_PAID", sourceKey: draft.id, recipientUserId: employeeId },
    })).toBe(1);
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

  it("supports draft item editing, total recalculation, and cancellation", async () => {
    const draft = await service!.createDraft(employeeId);

    const withFirstItem = await service!.addItem(employeeId, draft.id, { menuItemId, quantity: 2, note: "Ít đá" });
    expect(withFirstItem.totalAmount).toBe(50_000);

    const withSecondItem = await service!.addItem(employeeId, draft.id, { menuItemId: secondMenuItemId, quantity: 1 });
    expect(withSecondItem.totalAmount).toBe(100_000);

    const firstLine = withSecondItem.items.find((item) => item.menuItemId === menuItemId);
    const secondLine = withSecondItem.items.find((item) => item.menuItemId === secondMenuItemId);
    expect(firstLine).toBeTruthy();
    expect(secondLine).toBeTruthy();

    const updated = await service!.updateItem(employeeId, draft.id, firstLine!.id, { quantity: 3, note: "Nhiều đá" });
    expect(updated.totalAmount).toBe(125_000);
    expect(updated.items.find((item) => item.id === firstLine!.id)).toMatchObject({ quantity: 3, note: "Nhiều đá" });

    const afterDelete = await service!.deleteItem(employeeId, draft.id, secondLine!.id);
    expect(afterDelete.totalAmount).toBe(75_000);
    expect(afterDelete.items).toHaveLength(1);

    const cancelled = await service!.cancelDraft(employeeId, draft.id);
    expect(cancelled.fulfillmentStatus).toBe("CANCELLED");
    expect(cancelled.cancellationReason).toBe("Cancelled by service staff");

    await expect(service!.updateItem(employeeId, draft.id, firstLine!.id, { quantity: 1 })).rejects.toMatchObject({ code: "ORDER_NOT_EDITABLE" });
    expect(await database!.orderStatusHistory.count({ where: { orderId: draft.id } })).toBe(2);
  });
});
