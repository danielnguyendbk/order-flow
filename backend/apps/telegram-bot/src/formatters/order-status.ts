const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PENDING: "Chờ xác nhận thanh toán",
  PAID: "Đã thanh toán",
  UNDERPAID: "Thanh toán thiếu",
  OVERPAID: "Thanh toán thừa",
  REVIEW: "Cần kiểm tra thanh toán",
};

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  QUEUED: "Chờ pha",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

const STATUS_DOMAIN_LABELS: Record<string, string> = {
  PAYMENT: "Thanh toán",
  FULFILLMENT: "Pha chế",
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function fulfillmentStatusLabel(status: string): string {
  return FULFILLMENT_STATUS_LABELS[status] ?? status;
}

export function statusDomainLabel(domain: string): string {
  return STATUS_DOMAIN_LABELS[domain] ?? domain;
}

export function statusTransitionLabel(domain: string, status: string): string {
  return domain === "PAYMENT" ? paymentStatusLabel(status) : fulfillmentStatusLabel(status);
}

export function orderStatusSummary(paymentStatus: string, fulfillmentStatus: string): string {
  return `${paymentStatusLabel(paymentStatus)} · ${fulfillmentStatusLabel(fulfillmentStatus)}`;
}
