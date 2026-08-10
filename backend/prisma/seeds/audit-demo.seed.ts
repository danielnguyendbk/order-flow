import { PrismaClient, AuditEntityType, UserRole, UserStatus } from "@prisma/client";

export async function seedAuditDemo(prisma: PrismaClient) {
  console.log("Starting audit logs seed...");

  let owner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER, status: UserStatus.ACTIVE },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        fullName: "Quản lý Cửa Hàng",
        username: "demo_owner",
        passwordHash: "demo-hash",
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });
  }

  const logsToSeed = [
    {
      actorUserId: owner.id,
      action: "USER_LOGIN_SUCCESS",
      entityType: AuditEntityType.USER,
      entityId: owner.id,
      details: { ip: "127.0.0.1", userAgent: "Mozilla/5.0 (Windows NT 10.0)", role: "OWNER" },
      createdAt: new Date(Date.now() - 3600000 * 5),
    },
    {
      actorUserId: owner.id,
      action: "ORDER_CREATED",
      entityType: AuditEntityType.ORDER,
      entityId: null,
      details: { orderCode: "ORD-RECON-101", amountVnd: 90000, channel: "TELEGRAM_BOT", location: "Bàn 04" },
      createdAt: new Date(Date.now() - 3600000 * 4),
    },
    {
      actorUserId: null,
      action: "SEPAY_WEBHOOK_RECEIVED",
      entityType: AuditEntityType.SEPAY_TRANSACTION,
      entityId: null,
      details: { sepayTxId: "9900101", amountIn: 70000, matchStatus: "UNMATCHED", gateway: "VietinBank" },
      createdAt: new Date(Date.now() - 3600000 * 3),
    },
    {
      actorUserId: owner.id,
      action: "PAYMENT_REVIEW_FLAGGED",
      entityType: AuditEntityType.PAYMENT,
      entityId: null,
      details: { orderCode: "ORD-RECON-101", reason: "UNDERPAID", expected: 90000, received: 70000 },
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      actorUserId: owner.id,
      action: "MENU_ITEM_UPDATED",
      entityType: AuditEntityType.MENU_ITEM,
      entityId: null,
      details: { itemName: "Trà Nhài Kem Muối", newPrice: 45000, isAvailable: true },
      createdAt: new Date(Date.now() - 3600000 * 1),
    },
    {
      actorUserId: owner.id,
      action: "MANUAL_RECONCILIATION_LINKED",
      entityType: AuditEntityType.SEPAY_TRANSACTION,
      entityId: null,
      details: { orderCode: "ORD-RECON-105", action: "LINK_MANUALLY", note: "Đã liên kết thủ công với bàn 02" },
      createdAt: new Date(),
    },
  ];

  for (const item of logsToSeed) {
    await prisma.auditLog.create({
      data: {
        actorUserId: item.actorUserId,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        details: item.details,
        createdAt: item.createdAt,
      },
    });
  }

  console.log("Successfully seeded audit log records!");
}
