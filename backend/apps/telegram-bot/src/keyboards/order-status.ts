import { Markup } from "telegraf";

import type { DraftOrder } from "../api/order-types.js";

export function myOrdersKeyboard(orders: DraftOrder[]) {
  return Markup.inlineKeyboard(orders.map((order) => [
    Markup.button.callback(`${order.code} · ${order.paymentStatus}/${order.fulfillmentStatus}`, `order:status:${order.id}`),
  ]));
}

export function orderStatusKeyboard(order: DraftOrder) {
  const rows = [];
  if (order.fulfillmentStatus === "READY") {
    rows.push([Markup.button.callback("Đã giao khách", `order:deliver:${order.id}`)]);
  }
  rows.push(
    [Markup.button.callback("Làm mới trạng thái", `order:status:${order.id}`)],
    [Markup.button.callback("Đơn của tôi", "service:orders:mine")],
  );
  return Markup.inlineKeyboard(rows);
}

export function qrPaymentKeyboard(orderId: string, qrImageUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url("Mở mã QR", qrImageUrl)],
    [Markup.button.callback("Kiểm tra thanh toán", `order:status:${orderId}`)],
  ]);
}
