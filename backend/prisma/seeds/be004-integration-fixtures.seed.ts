import {
  FulfillmentStatus,
  OrderStatusDomain,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";

const passwordRounds = 10;
const devOnlyPassword = "be004-dev-password";
const paidAt = new Date("2026-08-04T00:00:00.000Z");

const fixtures = {
  users: {
    owner: {
      id: "00000000-0000-4000-8000-000000004001",
      fullName: "BE004 Owner Manager",
      username: "be004_owner",
      telegramUserId: BigInt(94004001),
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
    serviceStaff: {
      id: "00000000-0000-4000-8000-000000004002",
      fullName: "BE004 Service Staff",
      username: "be004_service_staff",
      telegramUserId: BigInt(94004002),
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.ACTIVE,
    },
    barista: {
      id: "00000000-0000-4000-8000-000000004003",
      fullName: "BE004 Barista",
      username: "be004_barista",
      telegramUserId: BigInt(94004003),
      role: UserRole.BARISTA,
      status: UserStatus.ACTIVE,
    },
    inactiveStaff: {
      id: "00000000-0000-4000-8000-000000004004",
      fullName: "BE004 Inactive Staff",
      username: "be004_inactive_staff",
      telegramUserId: BigInt(94004004),
      role: UserRole.SERVICE_STAFF,
      status: UserStatus.INACTIVE,
    },
  },
  menu: {
    activeCategory: {
      id: "00000000-0000-4000-8000-000000004101",
      name: "BE004 Drinks",
      displayOrder: 400,
      isActive: true,
    },
    inactiveCategory: {
      id: "00000000-0000-4000-8000-000000004102",
      name: "BE004 Hidden Drinks",
      displayOrder: 401,
      isActive: false,
    },
    activeItem: {
      id: "00000000-0000-4000-8000-000000004201",
      name: "BE004 Iced Latte",
      description: "Stable active item for integration tests",
      price: BigInt(45000),
      isAvailable: true,
      displayOrder: 400,
    },
    inactiveItem: {
      id: "00000000-0000-4000-8000-000000004202",
      name: "BE004 Inactive Mocha",
      description: "Stable inactive item for visibility tests",
      price: BigInt(50000),
      isAvailable: false,
      displayOrder: 401,
    },
  },
  orders: {
    queued: {
      id: "00000000-0000-4000-8000-000000004301",
      itemId: "00000000-0000-4000-8000-000000004401",
      paymentId: "00000000-0000-4000-8000-000000004501",
      orderCode: "BE004-QUEUED-001",
      paymentCode: "PAY-BE004-QUEUED-001",
      quantity: 1,
      note: "BE004 queued order for barista smoke tests",
    },
  },
} as const;

export async function seedBe004IntegrationFixtures(prisma: PrismaClient): Promise<void> {
  const ownerPasswordHash = await hash(devOnlyPassword, passwordRounds);

  await prisma.user.upsert({
    where: { id: fixtures.users.owner.id },
    create: {
      ...fixtures.users.owner,
      passwordHash: ownerPasswordHash,
    },
    update: {
      fullName: fixtures.users.owner.fullName,
      telegramUserId: fixtures.users.owner.telegramUserId,
      username: fixtures.users.owner.username,
      passwordHash: ownerPasswordHash,
      role: fixtures.users.owner.role,
      status: fixtures.users.owner.status,
    },
  });

  await Promise.all(
    [fixtures.users.serviceStaff, fixtures.users.barista, fixtures.users.inactiveStaff].map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        create: {
          ...user,
          passwordHash: null,
        },
        update: {
          fullName: user.fullName,
          telegramUserId: user.telegramUserId,
          username: user.username,
          role: user.role,
          status: user.status,
          passwordHash: null,
        },
      }),
    ),
  );

  const activeCategory = await prisma.menuCategory.upsert({
    where: { id: fixtures.menu.activeCategory.id },
    create: fixtures.menu.activeCategory,
    update: {
      name: fixtures.menu.activeCategory.name,
      displayOrder: fixtures.menu.activeCategory.displayOrder,
      isActive: fixtures.menu.activeCategory.isActive,
    },
  });

  await prisma.menuCategory.upsert({
    where: { id: fixtures.menu.inactiveCategory.id },
    create: fixtures.menu.inactiveCategory,
    update: {
      name: fixtures.menu.inactiveCategory.name,
      displayOrder: fixtures.menu.inactiveCategory.displayOrder,
      isActive: fixtures.menu.inactiveCategory.isActive,
    },
  });

  const activeItem = await prisma.menuItem.upsert({
    where: { id: fixtures.menu.activeItem.id },
    create: {
      ...fixtures.menu.activeItem,
      categoryId: activeCategory.id,
    },
    update: {
      categoryId: activeCategory.id,
      name: fixtures.menu.activeItem.name,
      description: fixtures.menu.activeItem.description,
      price: fixtures.menu.activeItem.price,
      isAvailable: fixtures.menu.activeItem.isAvailable,
      displayOrder: fixtures.menu.activeItem.displayOrder,
    },
  });

  await prisma.menuItem.upsert({
    where: { id: fixtures.menu.inactiveItem.id },
    create: {
      ...fixtures.menu.inactiveItem,
      categoryId: activeCategory.id,
    },
    update: {
      categoryId: activeCategory.id,
      name: fixtures.menu.inactiveItem.name,
      description: fixtures.menu.inactiveItem.description,
      price: fixtures.menu.inactiveItem.price,
      isAvailable: fixtures.menu.inactiveItem.isAvailable,
      displayOrder: fixtures.menu.inactiveItem.displayOrder,
    },
  });

  const queuedTotal = activeItem.price * BigInt(fixtures.orders.queued.quantity);
  const queuedOrder = await prisma.order.upsert({
    where: { id: fixtures.orders.queued.id },
    create: {
      id: fixtures.orders.queued.id,
      orderCode: fixtures.orders.queued.orderCode,
      createdByUserId: fixtures.users.serviceStaff.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      totalAmount: queuedTotal,
      paidAt,
      customerNote: fixtures.orders.queued.note,
    },
    update: {
      orderCode: fixtures.orders.queued.orderCode,
      createdByUserId: fixtures.users.serviceStaff.id,
      assignedBaristaId: null,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      totalAmount: queuedTotal,
      paidAt,
      customerNote: fixtures.orders.queued.note,
      cancellationReason: null,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: fixtures.orders.queued.itemId },
    create: {
      id: fixtures.orders.queued.itemId,
      orderId: queuedOrder.id,
      menuItemId: activeItem.id,
      itemName: activeItem.name,
      unitPrice: activeItem.price,
      quantity: fixtures.orders.queued.quantity,
      note: null,
    },
    update: {
      orderId: queuedOrder.id,
      menuItemId: activeItem.id,
      itemName: activeItem.name,
      unitPrice: activeItem.price,
      quantity: fixtures.orders.queued.quantity,
      note: null,
    },
  });

  await prisma.payment.upsert({
    where: { id: fixtures.orders.queued.paymentId },
    create: {
      id: fixtures.orders.queued.paymentId,
      orderId: queuedOrder.id,
      paymentCode: fixtures.orders.queued.paymentCode,
      expectedAmount: queuedTotal,
      receivedAmount: queuedTotal,
      cashConfirmedByUserId: fixtures.users.owner.id,
      confirmedAt: paidAt,
    },
    update: {
      orderId: queuedOrder.id,
      paymentCode: fixtures.orders.queued.paymentCode,
      expectedAmount: queuedTotal,
      receivedAmount: queuedTotal,
      cashConfirmedByUserId: fixtures.users.owner.id,
      confirmedAt: paidAt,
    },
  });

  const paymentHistory = await prisma.orderStatusHistory.findFirst({
    where: {
      orderId: queuedOrder.id,
      statusDomain: OrderStatusDomain.PAYMENT,
      newStatus: PaymentStatus.PAID,
      reason: "BE004 fixture payment status",
    },
    select: { id: true },
  });

  if (!paymentHistory) {
    await prisma.orderStatusHistory.create({
      data: {
        orderId: queuedOrder.id,
        statusDomain: OrderStatusDomain.PAYMENT,
        oldStatus: PaymentStatus.UNPAID,
        newStatus: PaymentStatus.PAID,
        changedByUserId: fixtures.users.owner.id,
        reason: "BE004 fixture payment status",
        createdAt: paidAt,
      },
    });
  }

  const fulfillmentHistory = await prisma.orderStatusHistory.findFirst({
    where: {
      orderId: queuedOrder.id,
      statusDomain: OrderStatusDomain.FULFILLMENT,
      newStatus: FulfillmentStatus.QUEUED,
      reason: "BE004 fixture fulfillment status",
    },
    select: { id: true },
  });

  if (!fulfillmentHistory) {
    await prisma.orderStatusHistory.create({
      data: {
        orderId: queuedOrder.id,
        statusDomain: OrderStatusDomain.FULFILLMENT,
        oldStatus: FulfillmentStatus.PENDING_PAYMENT,
        newStatus: FulfillmentStatus.QUEUED,
        changedByUserId: fixtures.users.owner.id,
        reason: "BE004 fixture fulfillment status",
        createdAt: paidAt,
      },
    });
  }

  console.info(
    {
      users: {
        ownerUsername: fixtures.users.owner.username,
        ownerTelegramUserId: fixtures.users.owner.telegramUserId.toString(),
        serviceStaffTelegramUserId: fixtures.users.serviceStaff.telegramUserId.toString(),
        baristaTelegramUserId: fixtures.users.barista.telegramUserId.toString(),
        inactiveStaffTelegramUserId: fixtures.users.inactiveStaff.telegramUserId.toString(),
      },
      menu: {
        activeCategory: fixtures.menu.activeCategory.name,
        activeItem: fixtures.menu.activeItem.name,
        inactiveCategory: fixtures.menu.inactiveCategory.name,
        inactiveItem: fixtures.menu.inactiveItem.name,
      },
      orders: {
        queuedOrderCode: fixtures.orders.queued.orderCode,
      },
    },
    "BE004 integration fixtures seed completed",
  );
}
