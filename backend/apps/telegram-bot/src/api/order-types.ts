export interface MenuCategory {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface DraftOrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
}

export interface DraftOrder {
  id: string;
  code: string;
  paymentMethod?: "CASH" | "QR" | null;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "UNDERPAID" | "OVERPAID" | "REVIEW";
  fulfillmentStatus: "PENDING_PAYMENT" | "QUEUED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  items: DraftOrderItem[];
}

export interface QrPaymentResult {
  order: DraftOrder;
  paymentCode: string;
  amount: number;
  qrImageUrl: string;
}

export interface CreateOrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface UpdateOrderItemInput {
  quantity?: number;
  note?: string;
}
