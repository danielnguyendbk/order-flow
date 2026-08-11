/**
 * Generates a unique order code in the format: ORD-YYYYMMDD-XXXX
 * where XXXX is a random 4-digit number.
 * In production, replace the random component with an atomic DB sequence.
 */
export function generateOrderCode(): string {
  const now    = new Date();
  const date   = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
  return `ORD-${date}-${suffix}`;
}

/**
 * Generates a unique payment code tied to the order code.
 * SePay will match incoming transfers that reference this code.
 */
export function generatePaymentCode(orderCode: string): string {
  const normalizedOrderCode = orderCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const suffix = normalizedOrderCode.slice(-10);
  if (!suffix) throw new Error("Cannot generate a payment code from an empty order code");
  return `PAY${suffix}`;
}
