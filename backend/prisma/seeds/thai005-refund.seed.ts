import {
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";

const SEED = {
  ownerUsername: "thai005_owner",
  ownerName: "THAI005 Owner",
  ownerPasswordHash: "thai005-dev-password-hash",
  staffTelegramUserId: BigInt(91005001),
  staffTelegramChatId: BigInt(91005001),
  staffName: "THAI005 Service Staff",
  categoryName: "THAI005 Refund Drinks",
  itemName: "THAI005 Paid Coffee",
  itemPrice: BigInt(65000),
  itemQuantity: 2,
  orderCode: "THAI005-REFUND-001",
  paymentCode: "PAY-THAI005-REFUND-001",
};

export async function seedThai005Refund(prisma: PrismaClient) {
  const owner = await prisma.user.upsert({
    where: { username: SEED.ownerUsername },
    update: {
      fullName: SEED.ownerName,
      passwordHash: SEED.ownerPasswordHash,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: SEED.ownerName,
      username: SEED.ownerUsername,
      passwordHash: SEED.ownerPasswordHash,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  const serviceStaff = await prisma.user.upsert({
    where: { telegramUserId: SEED.staffTelegramUserId },
    update: {
      fullName: SEED.staffName,
      telegramChatId: SEED.staffTelegramChatId,
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: SEED.staffName,
      telegramUserId: SEED.staffTelegramUserId,
      telegramChatId: SEED.staffTelegramChatId,
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.ACTIVE,
    },
  });

  const category = await prisma.menuCategory.upsert({
    where: { name: SEED.categoryName },
    update: { displayOrder: 5, isActive: true },
    create: {
      name: SEED.categoryName,
      displayOrder: 5,
      isActive: true,
    },
  });

  const existingItem = await prisma.menuItem.findFirst({
    where: { categoryId: category.id, name: SEED.itemName },
  });

  const menuItem = existingItem
    ? await prisma.menuItem.update({
        where: { id: existingItem.id },
        data: {
          description: "Seed item for THAI-005 manual refund flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 5,
        },
      })
    : await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: SEED.itemName,
          description: "Seed item for THAI-005 manual refund flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 5,
        },
      });

  const totalAmount = menuItem.price * BigInt(SEED.itemQuantity);
  const paidAt = new Date();

  const order = await prisma.order.upsert({
    where: { orderCode: SEED.orderCode },
    update: {
      createdByUserId: serviceStaff.id,
      assignedBaristaId: null,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      totalAmount,
      customerNote: "THAI005 manual refund test order",
      cancellationReason: null,
      paidAt,
    },
    create: {
      orderCode: SEED.orderCode,
      createdByUserId: serviceStaff.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      totalAmount,
      customerNote: "THAI005 manual refund test order",
      paidAt,
    },
  });

  const existingOrderItem = await prisma.orderItem.findFirst({
    where: { orderId: order.id, menuItemId: menuItem.id },
  });

  if (existingOrderItem) {
    await prisma.orderItem.update({
      where: { id: existingOrderItem.id },
      data: {
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        quantity: SEED.itemQuantity,
        note: "THAI005 seed item",
      },
    });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        quantity: SEED.itemQuantity,
        note: "THAI005 seed item",
      },
    });
  }

  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      paymentCode: SEED.paymentCode,
      expectedAmount: totalAmount,
      receivedAmount: totalAmount,
      cashConfirmedByUserId: owner.id,
      confirmedAt: paidAt,
    },
    create: {
      orderId: order.id,
      paymentCode: SEED.paymentCode,
      expectedAmount: totalAmount,
      receivedAmount: totalAmount,
      cashConfirmedByUserId: owner.id,
      confirmedAt: paidAt,
    },
  });

  console.log("Seeded THAI-005 refund data");
  console.log({
    ownerId: owner.id,
    serviceStaffId: serviceStaff.id,
    orderId: order.id,
    orderCode: order.orderCode,
    paymentCode: SEED.paymentCode,
    totalAmount: totalAmount.toString(),
  });
}
