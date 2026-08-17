import { OrderStatusDomain } from "../orders/order.types";

/**
 * Represents a row in the `order_status_history` table.
 * Both payment and fulfillment transitions are stored here,
 * differentiated by `statusDomain`.
 */
export interface OrderStatusHistory {
  id:              string;
  orderId:         string;
  statusDomain:    OrderStatusDomain;
  oldStatus?:      string | null;
  newStatus:       string;
  changedByUserId?: string | null;
  reason?:         string | null;
  createdAt:       Date;
}

/**
 * Input to record a single status transition event.
 */
export interface CreateHistoryInput {
  orderId:         string;
  statusDomain:    OrderStatusDomain;
  oldStatus?:      string | null;
  newStatus:       string;
  changedByUserId?: string;
  reason?:         string;
}
