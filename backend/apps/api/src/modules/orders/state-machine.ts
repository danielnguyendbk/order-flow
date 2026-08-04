import { FulfillmentStatus, PaymentStatus } from "./order.types";

/**
 * Defines allowed FULFILLMENT status transitions.
 *
 * PENDING_PAYMENT → QUEUED     (payment confirmed → enters barista queue)
 * QUEUED          → PREPARING  (barista claims order)
 * PREPARING       → READY      (barista marks order ready for pickup)
 * READY           → DELIVERED  (barista/staff delivers to customer)
 *
 * From any non-terminal fulfillment state → CANCELLED (requires reason)
 *
 * Terminal states: DELIVERED, CANCELLED
 */
const VALID_FULFILLMENT_TRANSITIONS: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  [FulfillmentStatus.PENDING_PAYMENT]: [FulfillmentStatus.QUEUED,    FulfillmentStatus.CANCELLED],
  [FulfillmentStatus.QUEUED]:          [FulfillmentStatus.PREPARING, FulfillmentStatus.CANCELLED],
  [FulfillmentStatus.PREPARING]:       [FulfillmentStatus.READY,     FulfillmentStatus.CANCELLED],
  [FulfillmentStatus.READY]:           [FulfillmentStatus.DELIVERED],
  [FulfillmentStatus.DELIVERED]:       [],
  [FulfillmentStatus.CANCELLED]:       [],
};

/**
 * Defines allowed PAYMENT status transitions.
 *
 * UNPAID   → PENDING  (QR payment initiated)
 * PENDING  → PAID     (bank confirms)
 * PENDING  → REVIEW   (admin flag)
 * PAID     → OVERPAID | UNDERPAID (reconciliation discovers mismatch)
 * UNDERPAID| OVERPAID → REVIEW
 * Any      → REVIEW   (admin escalates)
 */
const VALID_PAYMENT_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  [PaymentStatus.UNPAID]:    [PaymentStatus.PENDING, PaymentStatus.REVIEW],
  [PaymentStatus.PENDING]:   [PaymentStatus.PAID, PaymentStatus.REVIEW],
  [PaymentStatus.PAID]:      [PaymentStatus.OVERPAID, PaymentStatus.UNDERPAID],
  [PaymentStatus.UNDERPAID]: [PaymentStatus.REVIEW],
  [PaymentStatus.OVERPAID]:  [PaymentStatus.REVIEW],
  [PaymentStatus.REVIEW]:    [],
};

// ── Fulfillment helpers ────────────────────────────────────────

/**
 * Validates a fulfillment status transition.
 */
export function isValidFulfillmentTransition(
  current: FulfillmentStatus,
  next: FulfillmentStatus
): boolean {
  return (VALID_FULFILLMENT_TRANSITIONS[current] ?? []).includes(next);
}

/**
 * Returns all allowed next fulfillment statuses from the current one.
 */
export function getAllowedFulfillmentTransitions(current: FulfillmentStatus): FulfillmentStatus[] {
  return VALID_FULFILLMENT_TRANSITIONS[current] ?? [];
}

/**
 * An order's items can only be modified while in PENDING_PAYMENT status
 * (i.e., before payment is made).
 */
export function isOrderEditable(fulfillmentStatus: FulfillmentStatus): boolean {
  return fulfillmentStatus === FulfillmentStatus.PENDING_PAYMENT;
}

/**
 * An order is in a terminal fulfillment state when DELIVERED or CANCELLED.
 * Admin status overrides are blocked for terminal orders.
 */
export function isFulfillmentTerminal(status: FulfillmentStatus): boolean {
  return status === FulfillmentStatus.DELIVERED || status === FulfillmentStatus.CANCELLED;
}

// ── Payment helpers ────────────────────────────────────────────

/**
 * Validates a payment status transition.
 */
export function isValidPaymentTransition(
  current: PaymentStatus,
  next: PaymentStatus
): boolean {
  return (VALID_PAYMENT_TRANSITIONS[current] ?? []).includes(next);
}

/**
 * An order's payment is in a terminal state when PAID or REVIEW
 * (no further automated transitions).
 */
export function isPaymentTerminal(status: PaymentStatus): boolean {
  return status === PaymentStatus.PAID || status === PaymentStatus.REVIEW;
}
