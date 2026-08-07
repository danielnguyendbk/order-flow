import {
  FulfillmentStatus,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";

const SEED = {
  ownerUsername: "thai002_owner",
  ownerName: "THAI002 Owner",
  ownerPasswordHash: "thai002-dev-password-hash",
  staffTelegramUserId: BigInt(91002001),
  staffTelegramChatId: BigInt(91002001),
  staffName: "THAI002 Service Staff",
  categoryName: "THAI002 Drinks",
  itemName: "THAI002 Test Milk Tea",
  itemPrice: BigInt(45000),
  itemQuantity: 2,
  orderCode: "THAI002-QR-001",
  paymentCode: "PAY-THAI002-QR-001",
};

export async function seedThai002QrPayment(prisma: PrismaClient) {
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
      displayOrder: 2,
      isActive: true,
    },
    create: {
      name: SEED.categoryName,
      displayOrder: 2,
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
          description: "Seed item for THAI-002 QR payment flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 2,
        },
      })
    : await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: SEED.itemName,
          description: "Seed item for THAI-002 QR payment flow",
          price: SEED.itemPrice,
          isAvailable: true,
          displayOrder: 2,
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
      customerNote: "THAI002 QR payment test order",
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
      customerNote: "THAI002 QR payment test order",
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
        note: "THAI002 seed item",
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
        note: "THAI002 seed item",
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

  console.log("Seeded THAI-002 QR payment data");
  console.log({
    ownerId: owner.id,
    serviceStaffId: serviceStaff.id,
    orderId: order.id,
    orderCode: order.orderCode,
    paymentCode: SEED.paymentCode,
    totalAmount: totalAmount.toString(),
  });
}
