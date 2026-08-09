import { Markup } from "telegraf";

import type { BaristaOrder } from "../api/order-types.js";

export function baristaOrdersKeyboard(orders: BaristaOrder[]) {
  return Markup.inlineKeyboard(orders.map((order) => [
    Markup.button.callback(`${order.code} · ${order.fulfillmentStatus}`, `barista:view:${order.id}`),
  ]));
}

export function baristaOrderKeyboard(order: BaristaOrder) {
  const rows = [];
  if (order.fulfillmentStatus === "QUEUED" && !order.assignedBaristaId) {
    rows.push([Markup.button.callback("Nhận đơn", `barista:claim:${order.id}`)]);
  }
  if (order.fulfillmentStatus === "PREPARING") {
    rows.push([Markup.button.callback("Đã pha xong", `barista:ready:${order.id}`)]);
  }
  if (order.assignedBaristaId) {
    rows.push([Markup.button.callback("Lịch sử trạng thái", `barista:history:${order.id}`)]);
  }
  rows.push([Markup.button.callback("Làm mới", `barista:view:${order.id}`)]);
  rows.push([Markup.button.callback("Hàng đợi", "barista:queue")]);
  return Markup.inlineKeyboard(rows);
}

export function baristaHistoryKeyboard(orderId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Quay lại đơn", `barista:view:${orderId}`)],
    [Markup.button.callback("Lịch sử pha chế", "barista:orders:mine")],
  ]);
}
