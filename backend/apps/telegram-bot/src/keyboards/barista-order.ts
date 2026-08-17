import { Markup } from "telegraf";

import type { BaristaOrder } from "../api/order-types.js";
import { fulfillmentStatusLabel } from "../formatters/order-status.js";

export function baristaStatusLabel(status: string): string {
  return fulfillmentStatusLabel(status);
}

function itemCount(order: BaristaOrder): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function baristaOrdersKeyboard(orders: BaristaOrder[]) {
  return Markup.inlineKeyboard(orders.slice(0, 10).map((order) => [
    Markup.button.callback(
      `${order.code} · ${itemCount(order)} món · ${baristaStatusLabel(order.fulfillmentStatus)}`,
      `barista:view:${order.id}`,
    ),
  ]));
}

export function baristaOrderKeyboard(order: BaristaOrder) {
  const rows = [];
  if (order.fulfillmentStatus === "QUEUED" && !order.assignedBaristaId) {
    rows.push([Markup.button.callback("☕ NHẬN & PHA ĐƠN", `barista:claim:${order.id}`)]);
  }
  if (order.fulfillmentStatus === "PREPARING") {
    rows.push([Markup.button.callback("✅ PHA XONG", `barista:ready:${order.id}`)]);
  }
  if (order.assignedBaristaId) {
    rows.push([Markup.button.callback("🕘 Lịch sử", `barista:history:${order.id}`)]);
  }
  rows.push([
    Markup.button.callback("🔄 Làm mới", `barista:view:${order.id}`),
    Markup.button.callback("☕ Hàng đợi", "barista:queue"),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function baristaHistoryKeyboard(orderId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⬅️ Quay lại đơn", `barista:view:${orderId}`)],
    [Markup.button.callback("📋 Đơn của tôi", "barista:orders:mine")],
  ]);
}
