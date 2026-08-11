import type { NotificationEvent, Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

const ORDER_MESSAGES: Record<"ORDER_PAID" | "ORDER_READY", (orderCode: string) => string> = {
  ORDER_PAID: (orderCode) => `✅ Đơn ${orderCode} đã được thanh toán và đang chờ pha.`,
  ORDER_READY: (orderCode) => `🥤 Đơn ${orderCode} đã sẵn sàng. Vui lòng giao cho khách.`,
};

function formatMoney(amount: bigint): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} đ`;
}

function baristaOrderMessage(order: {
  orderCode: string;
  totalAmount: bigint;
  paymentMethod: "CASH" | "QR" | null;
  items: Array<{ itemName: string; quantity: number; note: string | null }>;
}): string {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const itemLines = order.items.map((item, index) =>
    `${index + 1}. ${item.quantity} × ${item.itemName}${item.note ? `\n   LƯU Ý: ${item.note}` : ""}`,
  );
  return [
    `🔔 ĐƠN MỚI CHỜ PHA · ${order.orderCode}`,
    `${itemCount} món · ${formatMoney(order.totalAmount)} · ${order.paymentMethod === "QR" ? "QR" : "Tiền mặt"}`,
    "",
    ...itemLines,
    "",
    "Nhận đơn để bắt đầu pha.",
  ].join("\n");
}

function telegramDestination(user: { telegramChatId: bigint | null; telegramUserId: bigint | null }): bigint | null {
  return user.telegramChatId ?? user.telegramUserId;
}

export async function recordOrderNotification(
  database: TransactionClient,
  event: "ORDER_PAID" | "ORDER_READY",
  orderId: string,
): Promise<void> {
  const order = await database.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderCode: true,
      totalAmount: true,
      paymentMethod: true,
      createdByUserId: true,
      creator: { select: { telegramChatId: true, telegramUserId: true } },
      items: {
        select: { itemName: true, quantity: true, note: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) throw new Error(`Cannot create ${event} notification: order ${orderId} does not exist`);

  const destination = telegramDestination(order.creator);
  if (destination !== null) {
    await database.notification.upsert({
      where: {
        event_sourceKey_recipientUserId: {
          event,
          sourceKey: order.id,
          recipientUserId: order.createdByUserId,
        },
      },
      create: {
        event,
        sourceKey: order.id,
        orderId: order.id,
        recipientUserId: order.createdByUserId,
        recipientTelegramChatId: destination,
        message: ORDER_MESSAGES[event](order.orderCode),
      },
      update: {},
    });
  }

  if (event !== "ORDER_PAID") return;

  const baristas = await database.user.findMany({
    where: {
      role: "BARISTA",
      status: "ACTIVE",
      OR: [{ telegramChatId: { not: null } }, { telegramUserId: { not: null } }],
    },
    select: { id: true, telegramChatId: true, telegramUserId: true },
  });
  const message = baristaOrderMessage(order);
  const notifications = baristas.flatMap((barista) => {
    const baristaDestination = telegramDestination(barista);
    return baristaDestination === null ? [] : [{
      event: "ORDER_PAID" as NotificationEvent,
      sourceKey: order.id,
      orderId: order.id,
      recipientUserId: barista.id,
      recipientTelegramChatId: baristaDestination,
      message,
    }];
  });
  if (notifications.length > 0) {
    await database.notification.createMany({ data: notifications, skipDuplicates: true });
  }
}

export interface PaymentReviewNotificationInput {
  sourceKey: string;
  orderId?: string;
}

export async function recordPaymentReviewNotifications(
  database: TransactionClient,
  input: PaymentReviewNotificationInput,
): Promise<number> {
  const owners = await database.user.findMany({
    where: {
      role: "OWNER",
      status: "ACTIVE",
      OR: [{ telegramChatId: { not: null } }, { telegramUserId: { not: null } }],
    },
    select: { id: true, telegramChatId: true, telegramUserId: true },
  });
  const message = `⚠️ Thanh toán ${input.sourceKey} cần được kiểm tra thủ công.`;
  const notifications = owners.flatMap((owner) => {
    const destination = telegramDestination(owner);
    return destination === null
      ? []
      : [{
          event: "PAYMENT_REVIEW" as NotificationEvent,
          sourceKey: input.sourceKey,
          orderId: input.orderId,
          recipientUserId: owner.id,
          recipientTelegramChatId: destination,
          message,
        }];
  });
  if (notifications.length === 0) return 0;

  const result = await database.notification.createMany({ data: notifications, skipDuplicates: true });
  return result.count;
}
