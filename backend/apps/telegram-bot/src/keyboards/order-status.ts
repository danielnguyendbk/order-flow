import { Markup } from "telegraf";

import type { DraftOrder } from "../api/order-types.js";

export function myOrdersKeyboard(orders: DraftOrder[]) {
  return Markup.inlineKeyboard(orders.map((order) => [
    Markup.button.callback(`${order.code} · ${order.paymentStatus}/${order.fulfillmentStatus}`, `order:status:${order.id}`),
  ]));
}

export function orderStatusKeyboard(orderId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Làm mới trạng thái", `order:status:${orderId}`)],
    [Markup.button.callback("Đơn của tôi", "service:orders:mine")],
  ]);
}

export function qrPaymentKeyboard(orderId: string, qrImageUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url("Mở mã QR", qrImageUrl)],
    [Markup.button.callback("Kiểm tra thanh toán", `order:status:${orderId}`)],
  ]);
}
