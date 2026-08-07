import {
  FulfillmentStatus,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";

const SEED = {
  ownerUsername: "thai001_owner",
  ownerName: "THAI001 Owner",
  ownerPasswordHash: "thai001-dev-password-hash",
  staffTelegramUserId: BigInt(91001001),
  staffTelegramChatId: BigInt(91001001),
  staffName: "THAI001 Service Staff",
  categoryName: "THAI001 Drinks",
  itemName: "THAI001 Test Coffee",
  itemPrice: BigInt(35000),
  itemQuantity: 2,
  orderCode: "THAI001-CASH-001",
  paymentCode: "PAY-THAI001-CASH-001",
};

export async function seedThai001CashPayment(prisma: PrismaClient) {
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
    update: {
      displayOrder: 1,
      isActive: true,
    },
    create: {
      name: SEED.categoryName,
      displayOrder: 1,
      isActive: true,
    },
  });

  const existingItem = await prisma.menuItem.findFirst({
    where: {
      categoryId: category.id,
      name: SEED.itemName,
    },
  });

  const menuItem = existingItem
    ? await prisma.menuItem.update({
        where: { id: existingItem.id },
        data: {
          description: "Seed item for THAI-001 cash payment flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 1,
        },
      })
    : await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: SEED.itemName,
          description: "Seed item for THAI-001 cash payment flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 1,
        },
      });

  const totalAmount = menuItem.price * BigInt(SEED.itemQuantity);

  const order = await prisma.order.upsert({
    where: { orderCode: SEED.orderCode },
    update: {
      createdByUserId: serviceStaff.id,
      assignedBaristaId: null,
      paymentMethod: null,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      totalAmount,
      customerNote: "THAI001 cash payment test order",
      cancellationReason: null,
      paidAt: null,
    },
    create: {
      orderCode: SEED.orderCode,
      createdByUserId: serviceStaff.id,
      paymentMethod: null,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      totalAmount,
      customerNote: "THAI001 cash payment test order",
    },
  });

  const existingOrderItem = await prisma.orderItem.findFirst({
    where: {
      orderId: order.id,
      menuItemId: menuItem.id,
    },
  });

  if (existingOrderItem) {
    await prisma.orderItem.update({
      where: { id: existingOrderItem.id },
      data: {
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        quantity: SEED.itemQuantity,
        note: "THAI001 seed item",
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
        note: "THAI001 seed item",
      },
    });
  }

  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      paymentCode: SEED.paymentCode,
      expectedAmount: totalAmount,
      receivedAmount: BigInt(0),
      cashConfirmedByUserId: null,
      confirmedAt: null,
    },
    create: {
      orderId: order.id,
      paymentCode: SEED.paymentCode,
      expectedAmount: totalAmount,
      receivedAmount: BigInt(0),
    },
  });

  console.log("Seeded THAI-001 cash payment data");
  console.log({
    ownerId: owner.id,
    serviceStaffId: serviceStaff.id,
    orderId: order.id,
    orderCode: order.orderCode,
    paymentCode: SEED.paymentCode,
    totalAmount: totalAmount.toString(),
  });
}
