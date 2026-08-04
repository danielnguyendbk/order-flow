/**
 * Calculates the subtotal for a list of order items.
 * Amounts are stored as bigint (VND has no decimal places).
 *
 * @param items - Array of items with unitPrice (bigint|number) and quantity.
 * @returns Subtotal as bigint.
 */
export function calculateSubtotal(
  items: Array<{ unitPrice: bigint | number; quantity: number }>
): bigint {
  return items.reduce(
    (sum, item) => sum + BigInt(item.unitPrice) * BigInt(item.quantity),
    0n
  );
}

/**
 * Calculates the total for an order.
 * For VND, there is typically no tax added at order level
 * (prices are tax-inclusive). This function returns the
 * subtotal directly but can be extended with tax logic.
 *
 * @param items - Array of order items.
 * @returns Total amount as bigint.
 */
export function calculateTotal(
  items: Array<{ unitPrice: bigint | number; quantity: number }>
): bigint {
  return calculateSubtotal(items);
}
