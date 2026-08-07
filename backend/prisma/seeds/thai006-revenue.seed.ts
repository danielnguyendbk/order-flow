import {
  AuditEntityType,
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";

const STAFF_TELEGRAM_ID = BigInt(91006001);

const ORDERS = [
  {
    key: "CASH",
    orderCode: "THAI006-CASH-001",
    paymentCode: "PAY-THAI006-CASH-001",
    itemName: "THAI006 Cash Coffee",
    paymentMethod: PaymentMethod.CASH,
    price: BigInt(50000),
    quantity: 2,
  },
  {
    key: "QR",
    orderCode: "THAI006-QR-001",
    paymentCode: "PAY-THAI006-QR-001",
    itemName: "THAI006 QR Tea",
    paymentMethod: PaymentMethod.QR,
    price: BigInt(45000),
    quantity: 2,
  },
  {
    key: "REFUNDED",
    orderCode: "THAI006-REFUNDED-001",
    paymentCode: "PAY-THAI006-REFUNDED-001",
    itemName: "THAI006 Refunded Latte",
    paymentMethod: PaymentMethod.CASH,
    price: BigInt(70000),
    quantity: 1,
  },
];

export async function seedThai006Revenue(prisma: PrismaClient) {
  const owner = await prisma.user.upsert({
    where: { username: "thai006_owner" },
    update: {
      fullName: "THAI006 Owner",
      passwordHash: "thai006-dev-password-hash",
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: "THAI006 Owner",
      username: "thai006_owner",
      passwordHash: "thai006-dev-password-hash",
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  const serviceStaff = await prisma.user.upsert({
    where: { telegramUserId: STAFF_TELEGRAM_ID },
    update: {
      fullName: "THAI006 Service Staff",
      telegramChatId: STAFF_TELEGRAM_ID,
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: "THAI006 Service Staff",
      telegramUserId: STAFF_TELEGRAM_ID,
      telegramChatId: STAFF_TELEGRAM_ID,
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.ACTIVE,
    },
  });

  const category = await prisma.menuCategory.upsert({
    where: { name: "THAI006 Revenue Drinks" },
    update: { displayOrder: 6, isActive: true },
    create: {
      name: "THAI006 Revenue Drinks",
      displayOrder: 6,
      isActive: true,
    },
  });

  const paidAt = new Date();
  const output = [];

  for (const spec of ORDERS) {
    const existingItem = await prisma.menuItem.findFirst({
      where: { categoryId: category.id, name: spec.itemName },
    });

    const menuItem = existingItem
      ? await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: {
            description: `Seed item for THAI-006 ${spec.key} revenue report`,
            price: spec.price,
            isAvailable: true,
            displayOrder: 6,
          },
        })
      : await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            name: spec.itemName,
            description: `Seed item for THAI-006 ${spec.key} revenue report`,
            price: spec.price,
            isAvailable: true,
            displayOrder: 6,
          },
        });

    const totalAmount = menuItem.price * BigInt(spec.quantity);

    const order = await prisma.order.upsert({
      where: { orderCode: spec.orderCode },
      update: {
        createdByUserId: serviceStaff.id,
        assignedBaristaId: null,
        paymentMethod: spec.paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        totalAmount,
        customerNote: `THAI006 ${spec.key} revenue report test order`,
        cancellationReason: null,
        paidAt,
      },
      create: {
        orderCode: spec.orderCode,
        createdByUserId: serviceStaff.id,
        paymentMethod: spec.paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.QUEUED,
        totalAmount,
        customerNote: `THAI006 ${spec.key} revenue report test order`,
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
          quantity: spec.quantity,
          note: `THAI006 ${spec.key} seed item`,
        },
      });
    } else {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          unitPrice: menuItem.price,
          quantity: spec.quantity,
          note: `THAI006 ${spec.key} seed item`,
        },
      });
    }

    const payment = await prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        paymentCode: spec.paymentCode,
        expectedAmount: totalAmount,
        receivedAmount: totalAmount,
        cashConfirmedByUserId: spec.paymentMethod === PaymentMethod.CASH ? owner.id : null,
        confirmedAt: spec.paymentMethod === PaymentMethod.CASH ? paidAt : null,
      },
      create: {
        orderId: order.id,
        paymentCode: spec.paymentCode,
        expectedAmount: totalAmount,
        receivedAmount: totalAmount,
        cashConfirmedByUserId: spec.paymentMethod === PaymentMethod.CASH ? owner.id : null,
        confirmedAt: spec.paymentMethod === PaymentMethod.CASH ? paidAt : null,
      },
    });

    if (spec.key === "REFUNDED") {
      const existingRefund = await prisma.auditLog.findFirst({
        where: {
          action: "MANUAL_REFUND_RECORDED",
          entityType: AuditEntityType.PAYMENT,
          entityId: payment.id,
        },
      });

      if (!existingRefund) {
        await prisma.auditLog.create({
          data: {
            actorUserId: owner.id,
            action: "MANUAL_REFUND_RECORDED",
            entityType: AuditEntityType.PAYMENT,
            entityId: payment.id,
            details: {
              orderId: order.id,
              orderCode: order.orderCode,
              paymentId: payment.id,
              refundAmount: totalAmount.toString(),
              receivedAmount: totalAmount.toString(),
              paymentMethod: spec.paymentMethod,
              previousPaymentStatus: PaymentStatus.PAID,
              reason: "THAI006 revenue seed refund",
            },
          },
        });
      }
    }

    output.push({
      case: spec.key,
      orderId: order.id,
      orderCode: order.orderCode,
      paymentCode: spec.paymentCode,
      amount: totalAmount.toString(),
    });
  }

  console.log("Seeded THAI-006 revenue data");
  console.log({
    ownerId: owner.id,
    serviceStaffId: serviceStaff.id,
    expectedTodayReport: {
      CASH: "170000",
      QR: "90000",
      REFUNDED: "70000",
      grossRevenue: "260000",
      netRevenue: "190000",
    },
    cases: output,
  });
}
