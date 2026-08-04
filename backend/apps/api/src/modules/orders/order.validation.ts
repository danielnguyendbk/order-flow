import { PaymentMethod, FulfillmentStatus, PaymentStatus } from "./order.types";

export interface ValidationResult {
  isValid: boolean;
  errors:  string[];
}

/**
 * Validates POST /api/v1/orders body.
 */
export function validateCreateOrder(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.createdByUserId || typeof data.createdByUserId !== "string") {
    errors.push("createdByUserId is required");
  }

  if (
    data.paymentMethod !== undefined &&
    !Object.values(PaymentMethod).includes(data.paymentMethod)
  ) {
    errors.push(`paymentMethod must be one of: ${Object.values(PaymentMethod).join(", ")}`);
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push("items must be a non-empty array");
  } else {
    data.items.forEach((item: any, idx: number) => {
      if (!item.menuItemId || typeof item.menuItemId !== "string") {
        errors.push(`items[${idx}].menuItemId is required`);
      }
      if (
        typeof item.quantity !== "number" ||
        item.quantity < 1 ||
        !Number.isInteger(item.quantity)
      ) {
        errors.push(`items[${idx}].quantity must be a positive integer`);
      }
    });
  }

  if (data.customerNote !== undefined && typeof data.customerNote !== "string") {
    errors.push("customerNote must be a string");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates POST /api/v1/orders/:orderId/items body.
 */
export function validateAddItem(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.menuItemId || typeof data.menuItemId !== "string") {
    errors.push("menuItemId is required");
  }
  if (
    typeof data.quantity !== "number" ||
    data.quantity < 1 ||
    !Number.isInteger(data.quantity)
  ) {
    errors.push("quantity must be a positive integer");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates PATCH /api/v1/orders/:orderId/items/:itemId body.
 */
export function validateUpdateItem(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (data.quantity !== undefined) {
    if (
      typeof data.quantity !== "number" ||
      data.quantity < 1 ||
      !Number.isInteger(data.quantity)
    ) {
      errors.push("quantity must be a positive integer");
    }
  }

  if (data.note !== undefined && data.note !== null && typeof data.note !== "string") {
    errors.push("note must be a string or null");
  }

  const updatableFields = ["quantity", "note"];
  if (!updatableFields.some((f) => f in data)) {
    errors.push("At least one of quantity or note must be provided");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates POST /api/v1/orders/:orderId/cancel body.
 * `reason` is mandatory — enforced by the SQL cancellation_reason_chk constraint.
 */
export function validateCancelOrder(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data?.reason || typeof data.reason !== "string" || data.reason.trim() === "") {
    errors.push("reason is required when cancelling an order");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates POST /api/v1/admin/orders/:orderId/override-status body.
 */
export function validateOverrideStatus(data: any): ValidationResult {
  const errors: string[] = [];

  const DOMAINS    = ["PAYMENT", "FULFILLMENT"];
  const F_STATUSES = Object.values(FulfillmentStatus);
  const P_STATUSES = Object.values(PaymentStatus);

  if (!data?.domain || !DOMAINS.includes(data.domain)) {
    errors.push(`domain must be one of: ${DOMAINS.join(", ")}`);
    return { isValid: false, errors };
  }

  const validStatuses = data.domain === "FULFILLMENT" ? F_STATUSES : P_STATUSES;
  if (!data.status || !(validStatuses as string[]).includes(data.status)) {
    errors.push(`status for domain ${data.domain} must be one of: ${validStatuses.join(", ")}`);
  }

  if (!data.adminId || typeof data.adminId !== "string") {
    errors.push("adminId is required");
  }

  return { isValid: errors.length === 0, errors };
}
