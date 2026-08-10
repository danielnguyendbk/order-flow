import type { ApiOrder } from "./api";
import type { Order, Payment, PaymentStatus } from "./data";

export function toOrder(order: ApiOrder): Order {
  const names = order.creator.fullName.trim().split(/\s+/);
  return {
    id: order.id,
    code: order.orderCode,
    createdAt: order.createdAt,
    expiresAt: order.updatedAt,
    deliveredAt: order.fulfillmentStatus === "DELIVERED" ? order.updatedAt : undefined,
    amountVnd: Number(order.totalAmount),
    subtotalVnd: Number(order.totalAmount),
    discountVnd: 0,
    quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    paymentStatus: order.paymentStatus === "REVIEW" ? "PAYMENT_REVIEW" : order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.paymentMethod === "CASH" ? "cash" : "qr",
    reviewReason: order.paymentStatus === "REVIEW" ? order.cancellationReason ?? "Cần kiểm tra thanh toán" : undefined,
    adminNote: order.cancellationReason ?? undefined,
    customerInput: order.customerNote ?? undefined,
    costVnd: 0,
    grossProfitVnd: Number(order.totalAmount),
    productName: order.items.map((item) => item.itemName).join(", ") || "Chưa có món",
    fulfillmentType: "stock",
    paidAmount: Number(order.payment?.receivedAmount ?? 0),
    paymentCount: order.payment ? 1 : 0,
    user: {
      telegramId: order.creator.telegramUserId ?? "",
      firstName: names[0] ?? "",
      lastName: names.slice(1).join(" "),
      username: order.creator.username ?? "",
    },
  };
}

function paymentStatus(order: ApiOrder): PaymentStatus {
  const transaction = order.payment?.sepayTransactions[0];
  if (transaction?.matchStatus === "WRONG_CODE") return "unknown_code";
  if (order.paymentStatus === "UNDERPAID") return "underpaid";
  if (order.paymentStatus === "OVERPAID") return "overpaid";
  if (order.paymentStatus === "PAID") return "matched";
  return "pending";
}

export function toPayment(order: ApiOrder): Payment | null {
  if (!order.payment) return null;
  const transaction = order.payment.sepayTransactions[0];
  return {
    id: order.payment.id,
    code: order.payment.paymentCode ?? `PAY-${order.orderCode}`,
    sepayId: transaction?.sepayTransactionId ?? null,
    type: "order",
    orderCode: order.orderCode,
    amountReceived: Number(order.payment.receivedAmount),
    amountExpected: Number(order.payment.expectedAmount),
    status: paymentStatus(order),
    createdAt: transaction?.receivedAt ?? order.payment.createdAt,
    note: order.cancellationReason ?? undefined,
    user: {
      telegramId: order.creator.telegramUserId ?? "",
      username: order.creator.username ?? "",
    },
  };
}
