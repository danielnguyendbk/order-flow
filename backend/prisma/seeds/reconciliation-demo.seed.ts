import {
  PrismaClient,
  UserRole,
  UserStatus,
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  TransactionMatchStatus,
  ResolutionAction,
} from "@prisma/client";

export async function seedReconciliationDemo(prisma: PrismaClient) {
  console.log("Starting reconciliation demo data seed...");

  // Find or create an active user to assign as creator
  let creator = await prisma.user.findFirst({
    where: { role: UserRole.OWNER, status: UserStatus.ACTIVE },
  });

  if (!creator) {
    creator = await prisma.user.create({
      data: {
        fullName: "Quản lý Cửa Hàng",
        username: "demo_owner",
        passwordHash: "demo-hash",
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // Find or create category and menu item
  let category = await prisma.menuCategory.findFirst();
  if (!category) {
    category = await prisma.menuCategory.create({
      data: {
        name: "Đồ Uống Demo",
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  let menuItem = await prisma.menuItem.findFirst({
    where: { categoryId: category.id },
  });
  if (!menuItem) {
    menuItem = await prisma.menuItem.create({
      data: {
        categoryId: category.id,
        name: "Cà Phê Sữa Đá",
        price: BigInt(35000),
        isAvailable: true,
      },
    });
  }

  // Helper to upsert order + payment + sepay transaction
  const itemsToSeed = [
    {
      orderCode: "ORD-RECON-101",
      customerInput: "Bàn 04",
      productName: "Trà Nhài Kem Muối",
      quantity: 2,
      expectedAmount: BigInt(90000),
      amountIn: BigInt(70000), // Thiếu 20k
      paymentStatus: PaymentStatus.UNDERPAID,
      fulfillmentStatus: FulfillmentStatus.PREPARING,
      matchStatus: TransactionMatchStatus.UNMATCHED,
      sepayTxId: BigInt(9900101),
      code: "ORD-RECON-101",
      content: "ORD-RECON-101 chuyen tien tra nhai kem muoi",
    },
    {
      orderCode: "ORD-RECON-102",
      customerInput: "Bàn 12",
      productName: "Cà Phê Sữa Đá x3 + Bánh Croissant",
      quantity: 4,
      expectedAmount: BigInt(140000),
      amountIn: BigInt(150000), // Thừa 10k
      paymentStatus: PaymentStatus.OVERPAID,
      fulfillmentStatus: FulfillmentStatus.QUEUED,
      matchStatus: TransactionMatchStatus.UNMATCHED,
      sepayTxId: BigInt(9900102),
      code: "ORD-RECON-102",
      content: "ORD-RECON-102 KH CHUYEN 150K",
    },
    {
      orderCode: "ORD-RECON-103",
      customerInput: "Bàn 08",
      productName: "Trà Đào Cam Sả",
      quantity: 2,
      expectedAmount: BigInt(90000),
      amountIn: BigInt(90000),
      paymentStatus: PaymentStatus.PENDING,
      fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
      matchStatus: TransactionMatchStatus.UNMATCHED,
      sepayTxId: BigInt(9900103),
      code: "ORD-RECON-103",
      content: "ORD-RECON-103 thanh toan tra dao cam sa",
    },
    {
      orderCode: "ORD-RECON-104",
      customerInput: "Mang đi",
      productName: "Sinh Tố Bơ Cốt Dừa",
      quantity: 2,
      expectedAmount: BigInt(110000),
      amountIn: BigInt(110000),
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.DELIVERED,
      matchStatus: TransactionMatchStatus.MATCHED,
      sepayTxId: BigInt(9900104),
      code: "ORD-RECON-104",
      content: "ORD-RECON-104 CHUYEN KHOAN FULL",
    },
    {
      orderCode: "ORD-RECON-105",
      customerInput: "Bàn 02",
      productName: "Matcha Latte Đá",
      quantity: 2,
      expectedAmount: BigInt(95000),
      amountIn: BigInt(95000),
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.READY,
      matchStatus: TransactionMatchStatus.REVIEWED,
      resolutionAction: ResolutionAction.LINK_MANUALLY,
      resolutionNote: "Đã liên kết thủ công với đơn hàng tại bàn 02.",
      sepayTxId: BigInt(9900105),
      code: "ORD-RECON-105",
      content: "ORD-RECON-105 matcha latte",
    },
  ];

  for (const item of itemsToSeed) {
    // 1. Create or update Order
    const order = await prisma.order.upsert({
      where: { orderCode: item.orderCode },
      update: {
        paymentMethod: PaymentMethod.QR,
        paymentStatus: item.paymentStatus,
        fulfillmentStatus: item.fulfillmentStatus,
        totalAmount: item.expectedAmount,
        customerNote: item.customerInput,
      },
      create: {
        orderCode: item.orderCode,
        createdByUserId: creator.id,
        paymentMethod: PaymentMethod.QR,
        paymentStatus: item.paymentStatus,
        fulfillmentStatus: item.fulfillmentStatus,
        totalAmount: item.expectedAmount,
        customerNote: item.customerInput,
      },
    });

    // 2. Create OrderItem
    const existingOrderItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id },
    });
    if (!existingOrderItem) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          itemName: item.productName,
          unitPrice: item.expectedAmount / BigInt(item.quantity),
          quantity: item.quantity,
        },
      });
    }

    // 3. Create or update Payment
    const payment = await prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        paymentCode: item.code,
        expectedAmount: item.expectedAmount,
        receivedAmount: item.amountIn,
        confirmedAt: item.paymentStatus === PaymentStatus.PAID ? new Date() : null,
      },
      create: {
        orderId: order.id,
        paymentCode: item.code,
        expectedAmount: item.expectedAmount,
        receivedAmount: item.amountIn,
        confirmedAt: item.paymentStatus === PaymentStatus.PAID ? new Date() : null,
      },
    });

    // 4. Create or update SepayTransaction
    const diff = item.amountIn - item.expectedAmount;
    const isResolved = item.resolutionAction && item.resolutionAction !== ResolutionAction.NONE;

    await prisma.sepayTransaction.upsert({
      where: { sepayTransactionId: item.sepayTxId },
      update: {
        paymentId: payment.id,
        transactionDate: new Date(),
        code: item.code,
        content: item.content,
        amountIn: item.amountIn,
        differenceAmount: diff,
        matchStatus: item.matchStatus,
        resolutionAction: item.resolutionAction ?? ResolutionAction.NONE,
        resolutionNote: item.resolutionNote ?? null,
        resolvedByUserId: isResolved ? creator.id : null,
        resolvedAt: isResolved ? new Date() : null,
      },
      create: {
        sepayTransactionId: item.sepayTxId,
        paymentId: payment.id,
        transactionDate: new Date(),
        code: item.code,
        content: item.content,
        amountIn: item.amountIn,
        differenceAmount: diff,
        matchStatus: item.matchStatus,
        resolutionAction: item.resolutionAction ?? ResolutionAction.NONE,
        resolutionNote: item.resolutionNote ?? null,
        resolvedByUserId: isResolved ? creator.id : null,
        resolvedAt: isResolved ? new Date() : null,
        rawPayload: { note: "Seeded for demo" },
      },
    });
  }

  // 5. Create a standalone WRONG_CODE SepayTransaction (not linked to any order)
  await prisma.sepayTransaction.upsert({
    where: { sepayTransactionId: BigInt(9900999) },
    update: {
      transactionDate: new Date(),
      code: "WRONG-CODE-999",
      content: "CHUYEN TIEN KHONG DE MA DON OR KHAC MA",
      amountIn: BigInt(120000),
      matchStatus: TransactionMatchStatus.WRONG_CODE,
      resolutionAction: ResolutionAction.NONE,
    },
    create: {
      sepayTransactionId: BigInt(9900999),
      transactionDate: new Date(),
      code: "WRONG-CODE-999",
      content: "CHUYEN TIEN KHONG DE MA DON OR KHAC MA",
      amountIn: BigInt(120000),
      matchStatus: TransactionMatchStatus.WRONG_CODE,
      resolutionAction: ResolutionAction.NONE,
      rawPayload: { note: "Unmatched / Wrong code transaction seed" },
    },
  });

  console.log("Successfully seeded reconciliation demo records!");
}
