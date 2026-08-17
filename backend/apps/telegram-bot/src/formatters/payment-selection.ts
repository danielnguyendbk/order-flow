import type { DraftOrder } from "../api/order-types.js";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export function formatPaymentSelection(order: DraftOrder): string {
  const lines = order.items.map(
    (item, index) => `${index + 1}. ${item.quantity} × ${item.name} · ${formatMoney(item.unitPrice * item.quantity)}${item.note ? `\n   📝 ${item.note}` : ""}`,
  );
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return [
    `🧾 ĐƠN ${order.code}`,
    `Số món: ${itemCount}`,
    "",
    ...(lines.length ? lines : ["Giỏ hàng đang trống."]),
    "",
    `💰 TỔNG: ${formatMoney(order.totalAmount)}`,
  ].join("\n");
}
