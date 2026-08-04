// ── Payment Status ────────────────────────────────────────────
/**
 * Tracks the payment lifecycle of an order.
 */
export enum PaymentStatus {
  UNPAID    = "UNPAID",
  PENDING   = "PENDING",    // QR scanned, awaiting bank confirmation
  PAID      = "PAID",
  UNDERPAID = "UNDERPAID",
  OVERPAID  = "OVERPAID",
  REVIEW    = "REVIEW",     // needs manual admin review
}

// ── Fulfillment Status ────────────────────────────────────────
/**
 * Tracks the physical preparation and delivery lifecycle of an order.
 * An order can only enter QUEUED+ if payment_status = PAID.
 */
export enum FulfillmentStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT", // waiting for payment
  QUEUED          = "QUEUED",          // paid, waiting for barista
  PREPARING       = "PREPARING",       // barista claimed & preparing
  READY           = "READY",           // ready for pickup
  DELIVERED       = "DELIVERED",       // handed to customer
  CANCELLED       = "CANCELLED",       // cancelled (reason required)
}

// ── Payment Method ────────────────────────────────────────────
export enum PaymentMethod {
  QR   = "QR",
  CASH = "CASH",
}

// ── Status Domain ─────────────────────────────────────────────
export enum OrderStatusDomain {
  PAYMENT     = "PAYMENT",
  FULFILLMENT = "FULFILLMENT",
}

// ── Entities ──────────────────────────────────────────────────

/**
 * Snapshot of a menu item at the time of ordering.
 */
export interface OrderItem {
  id:        string;
  orderId:   string;
  menuItemId: string;
  itemName:  string;
  unitPrice: bigint;
  quantity:  number;
  note?:     string | null;
}

/**
 * Full Order entity matching the `orders` table.
 */
export interface Order {
  id:                 string;
  orderCode:          string;
  createdByUserId:    string;
  assignedBaristaId?: string | null;
  paymentMethod?:     PaymentMethod | null;
  paymentStatus:      PaymentStatus;
  fulfillmentStatus:  FulfillmentStatus;
  totalAmount:        bigint;
  customerNote?:      string | null;
  cancellationReason?: string | null;
  paidAt?:            Date | null;
  items:              OrderItem[];
  createdAt:          Date;
  updatedAt:          Date;
}

/**
 * Payment entity matching the `payments` table.
 */
export interface Payment {
  id:                    string;
  orderId:               string;
  paymentCode?:          string | null;
  expectedAmount:        bigint;
  receivedAmount:        bigint;
  cashConfirmedByUserId?: string | null;
  confirmedAt?:          Date | null;
  createdAt:             Date;
  updatedAt:             Date;
}

// ── Input DTOs ────────────────────────────────────────────────

/**
 * Each item in a create-order request references a real menu item by ID.
 * itemName and unitPrice are taken from the MenuItem and snapshotted.
 */
export interface CreateOrderItemInput {
  menuItemId: string;
  quantity:   number;
  note?:      string;
}

/**
 * Payload for POST /api/v1/orders
 */
export interface CreateOrderInput {
  createdByUserId: string;
  paymentMethod?:  PaymentMethod;
  customerNote?:   string;
  items:           CreateOrderItemInput[];
}

/**
 * Payload for POST /api/v1/orders/:orderId/items
 */
export interface AddItemInput {
  menuItemId: string;
  quantity:   number;
  note?:      string;
}

/**
 * Payload for PATCH /api/v1/orders/:orderId/items/:itemId
 */
export interface UpdateItemInput {
  quantity?: number;
  note?:     string | null;
}

// ── Query helpers ─────────────────────────────────────────────

export interface PaginatedResult<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

export interface OrderFilters {
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?:     PaymentStatus;
  createdByUserId?:   string;
  assignedBaristaId?: string;
  page?:              number;
  limit?:             number;
}
