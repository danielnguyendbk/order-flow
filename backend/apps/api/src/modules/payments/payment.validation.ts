import { ValidationResult } from "../orders/order.validation";

export function validateConfirmCash(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.confirmedByUserId || typeof data.confirmedByUserId !== "string") {
    errors.push("confirmedByUserId is required");
  }

  if (data.amount !== undefined) {
    const isNumber = typeof data.amount === "number";
    const isInteger = isNumber && Number.isInteger(data.amount);
    if (!isInteger || data.amount < 0) {
      errors.push("amount must be a non-negative integer when provided");
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function validateInitQrPayment(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.requestedByUserId || typeof data.requestedByUserId !== "string") {
    errors.push("requestedByUserId is required");
  }

  return { isValid: errors.length === 0, errors };
}
