import { ValidationResult } from "../orders/order.validation";

export function validateSepayWebhook(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  const transactionId =
    data.sepayTransactionId ??
    data.sepay_transaction_id ??
    data.transactionId ??
    data.transaction_id ??
    data.id;

  if (transactionId === undefined || transactionId === null || transactionId === "") {
    errors.push("sepayTransactionId, transactionId, or id is required");
  } else if (!isBigIntLike(transactionId)) {
    errors.push("transaction id must be an integer-compatible value");
  }

  const amount = data.amountIn ?? data.amount_in ?? data.transferAmount ?? data.amount;
  if (amount === undefined || amount === null || amount === "") {
    errors.push("amountIn, transferAmount, or amount is required");
  } else if (!isBigIntLike(amount) || BigInt(amount) < BigInt(0)) {
    errors.push("amount must be a non-negative integer-compatible value");
  }

  return { isValid: errors.length === 0, errors };
}

function isBigIntLike(value: unknown): boolean {
  try {
    BigInt(value as any);
    return true;
  } catch {
    return false;
  }
}

