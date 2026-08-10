/* ============================================================
   View-model types & nhãn trạng thái dùng chung cho Web Admin.
   Dữ liệu thật được lấy từ backend qua `lib/api.ts`.
   ============================================================ */

export type OrderPaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "UNDERPAID"
  | "OVERPAID"
  | "PAYMENT_REVIEW"
  | "REFUNDED";

export type OrderFulfillmentStatus =
  | "PENDING_PAYMENT"
  | "QUEUED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus =
  | "pending"
  | "matched"
  | "underpaid"
  | "overpaid"
  | "unknown_code";

/* ── Nhãn trạng thái ── */
export const ORDER_PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PENDING: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  UNDERPAID: "Thiếu tiền",
  OVERPAID: "Thừa tiền",
  PAYMENT_REVIEW: "Cần kiểm tra",
  REFUNDED: "Đã hoàn tiền",
};

export const ORDER_FULFILLMENT_STATUS_LABEL: Record<OrderFulfillmentStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  QUEUED: "Chờ xử lý",
  PREPARING: "Đang xử lý",
  READY: "Sẵn sàng giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Chờ khớp",
  matched: "Đã khớp",
  underpaid: "Thiếu tiền",
  overpaid: "Thừa tiền",
  unknown_code: "Sai mã",
};

/* ── Đơn hàng ── */
export interface Order {
  id: string;
  code: string;
  createdAt: string;
  deliveredAt?: string;
  amountVnd: number;
  subtotalVnd: number;
  discountVnd: number;
  quantity: number;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  paymentMethod: "qr" | "cash";
  adminNote?: string;
  customerInput?: string;
  costVnd: number;
  grossProfitVnd: number;
  productName: string;
  paidAmount: number;
  user: { telegramId: string; firstName: string; lastName: string; username: string };
}

/* ── Giao dịch thanh toán ── */
export interface Payment {
  id: string;
  code: string;
  sepayId: string | null;
  amountExpected: number;
  amountReceived: number;
  status: PaymentStatus;
  note?: string;
  createdAt: string;
  user: { telegramId: string; username: string };
  orderCode?: string;
}

/* ── Timeline đơn hàng ── */
export type OrderTimelineEventStatus =
  | OrderFulfillmentStatus
  | "ORDER_CREATED"
  | "CANCELLED"
  | "REFUNDED"
  | "PAID"
  | "UNDERPAID"
  | "OVERPAID";

export interface OrderTimelineEvent {
  id: string;
  status: OrderTimelineEventStatus;
  label: string; // hiển thị
  at: string; // ISO
  by?: string; // người thực hiện
  note?: string;
}

export const TIMELINE_STATUS_LABEL: Record<OrderTimelineEventStatus, string> = {
  ...ORDER_FULFILLMENT_STATUS_LABEL,
  ORDER_CREATED: "Tạo đơn",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
  PAID: "Đã thanh toán",
  UNDERPAID: "Thiếu tiền",
  OVERPAID: "Thừa tiền",
};

/* ── Đối soát SePay ── */
export type ReconciliationClassification =
  | "matched" // đúng tiền
  | "underpaid" // thiếu tiền
  | "overpaid" // thừa tiền
  | "unknown_code" // sai mã
  | "duplicate"; // trùng lặp webhook

export interface Reconciliation {
  id: string;
  code: string; // mã giao dịch SePay
  orderCode?: string; // đơn liên quan (nếu có)
  orderId?: string; // id đơn liên quan (dẫn tới trang chi tiết)
  sepayId: string;
  amountExpected: number;
  amountReceived: number;
  classification: ReconciliationClassification;
  reason: string; // lý do phân loại
  status: "open" | "resolved"; // đã xử lý chưa
  resolvedBy?: string;
  resolvedAt?: string;
  resolveNote?: string; // ghi chú xử lý
  createdAt: string;
}

export const RECONCILIATION_CLASSIFICATION_LABEL: Record<ReconciliationClassification, string> = {
  matched: "Đúng tiền",
  underpaid: "Thiếu tiền",
  overpaid: "Thừa tiền",
  unknown_code: "Sai mã",
  duplicate: "Trùng lặp",
};

export const RECONCILIATION_STATUS_LABEL: Record<Reconciliation["status"], string> = {
  open: "Chưa xử lý",
  resolved: "Đã xử lý",
};
