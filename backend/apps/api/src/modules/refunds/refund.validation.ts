import { ValidationResult } from "../orders/order.validation";

export function validateRefundOrder(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.refundedByUserId || typeof data.refundedByUserId !== "string") {
    errors.push("refundedByUserId is required");
  }

  if (!data.reason || typeof data.reason !== "string" || data.reason.trim() === "") {
    errors.push("reason is required");
  }

  if (data.amount !== undefined) {
    if (
      typeof data.amount !== "number" ||
      !Number.isInteger(data.amount) ||
      data.amount <= 0
    ) {
      errors.push("amount must be a positive integer when provided");
    }
  }

  return { isValid: errors.length === 0, errors };
}

