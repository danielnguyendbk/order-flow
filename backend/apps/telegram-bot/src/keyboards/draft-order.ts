import { Markup } from "telegraf";

import type { DraftOrder, DraftOrderItem, MenuCategory, MenuItem } from "../api/order-types.js";
import { draftCallbackData } from "../callbacks/callback-data.js";

function rowsOfTwo<T>(buttons: T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  return rows;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
}

export function categoryKeyboard(categories: MenuCategory[], revision: string) {
  const buttons = categories.map((category) => Markup.button.callback(category.name, draftCallbackData(revision, "category", category.id)));
  return Markup.inlineKeyboard([
    ...rowsOfTwo(buttons),
    [Markup.button.callback("🧾 Xem giỏ", draftCallbackData(revision, "backReview")), Markup.button.callback("❌ Hủy đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function itemKeyboard(items: MenuItem[], revision: string) {
  const buttons = items
    .filter((item) => item.isActive)
    .map((item) => Markup.button.callback(`${item.name} · ${formatMoney(item.price)}đ`, draftCallbackData(revision, "item", item.id)));
  return Markup.inlineKeyboard([
    ...rowsOfTwo(buttons),
    [Markup.button.callback("⬅️ Danh mục", draftCallbackData(revision, "backCategories")), Markup.button.callback("🧾 Xem giỏ", draftCallbackData(revision, "backReview"))],
    [Markup.button.callback("❌ Hủy đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function quantityKeyboard(revision: string) {
  return Markup.inlineKeyboard([
    [1, 2, 3].map((quantity) => Markup.button.callback(String(quantity), draftCallbackData(revision, "quickQuantity", String(quantity)))),
    [4, 5].map((quantity) => Markup.button.callback(String(quantity), draftCallbackData(revision, "quickQuantity", String(quantity)))),
    [Markup.button.callback("❌ Hủy đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function noteKeyboard(revision: string) {
  return Markup.inlineKeyboard([[Markup.button.callback("✅ Không ghi chú", draftCallbackData(revision, "skipNote")), Markup.button.callback("❌ Hủy đơn", draftCallbackData(revision, "cancel"))]]);
}

export function reviewKeyboard(order: DraftOrder, revision: string) {
  return Markup.inlineKeyboard([
    ...(order.items.length ? [[
      Markup.button.callback("Tiền mặt", draftCallbackData(revision, "payCash")),
      Markup.button.callback("QR", draftCallbackData(revision, "payQr")),
    ]] : []),
    [Markup.button.callback("➕ Thêm món", draftCallbackData(revision, "addMore"))],
    ...order.items.map((item) => [Markup.button.callback(`✏️ ${item.quantity} × ${item.name}`, draftCallbackData(revision, "edit", item.id))]),
    [Markup.button.callback("❌ Hủy đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function paymentConfirmationKeyboard(revision: string) {
  return Markup.inlineKeyboard([[
    Markup.button.callback("✅ Xác nhận thanh toán", draftCallbackData(revision, "confirmPayment")),
    Markup.button.callback("❌ Hủy", draftCallbackData(revision, "cancelPayment")),
  ]]);
}

export function editItemKeyboard(item: DraftOrderItem, revision: string) {
  return Markup.inlineKeyboard([
    [
      ...(item.quantity > 1 ? [Markup.button.callback("➖", draftCallbackData(revision, "decreaseQuantity", item.id))] : []),
      Markup.button.callback(`SL: ${item.quantity}`, draftCallbackData(revision, "editQuantity", item.id)),
      ...(item.quantity < 99 ? [Markup.button.callback("➕", draftCallbackData(revision, "increaseQuantity", item.id))] : []),
    ],
    [Markup.button.callback("📝 Ghi chú", draftCallbackData(revision, "editNote", item.id)), Markup.button.callback("🗑 Xóa món", draftCallbackData(revision, "delete", item.id))],
    [Markup.button.callback("⬅️ Xem lại giỏ", draftCallbackData(revision, "backReview"))],
  ]);
}
