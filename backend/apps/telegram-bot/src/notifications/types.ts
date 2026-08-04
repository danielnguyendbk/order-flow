export type NotificationEvent = "ORDER_PAID" | "ORDER_READY" | "PAYMENT_REVIEW";

export interface NotificationJob {
  event: NotificationEvent;
  recipientTelegramUserId: number;
  orderId: string;
  message: string;
}
