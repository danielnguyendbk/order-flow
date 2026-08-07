import { Markup } from "telegraf";

import type { DraftOrder, DraftOrderItem, MenuCategory, MenuItem } from "../api/order-types.js";
import { draftCallbackData } from "../callbacks/callback-data.js";

export function categoryKeyboard(categories: MenuCategory[], revision: string) {
  return Markup.inlineKeyboard([
    ...categories.map((category) => [Markup.button.callback(category.name, draftCallbackData(revision, "category", category.id))]),
    [Markup.button.callback("Hủy tạo đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function itemKeyboard(items: MenuItem[], revision: string) {
  return Markup.inlineKeyboard([
    ...items.filter((item) => item.isActive).map((item) => [Markup.button.callback(item.name, draftCallbackData(revision, "item", item.id))]),
    [Markup.button.callback("← Danh mục", draftCallbackData(revision, "backCategories")), Markup.button.callback("Hủy", draftCallbackData(revision, "cancel"))],
  ]);
}

export function noteKeyboard(revision: string) {
  return Markup.inlineKeyboard([[Markup.button.callback("Bỏ qua ghi chú", draftCallbackData(revision, "skipNote")), Markup.button.callback("Hủy", draftCallbackData(revision, "cancel"))]]);
}

export function reviewKeyboard(order: DraftOrder, revision: string) {
  return Markup.inlineKeyboard([
    ...(order.items.length ? [[
      Markup.button.callback("Tiền mặt", draftCallbackData(revision, "payCash")),
      Markup.button.callback("QR", draftCallbackData(revision, "payQr")),
    ]] : []),
    [Markup.button.callback("Thêm món", draftCallbackData(revision, "addMore"))],
    ...order.items.map((item) => [Markup.button.callback(`Sửa: ${item.name}`, draftCallbackData(revision, "edit", item.id))]),
    [Markup.button.callback("Hủy đơn", draftCallbackData(revision, "cancel"))],
  ]);
}

export function editItemKeyboard(item: DraftOrderItem, revision: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Sửa số lượng", draftCallbackData(revision, "editQuantity", item.id))],
    [Markup.button.callback("Sửa ghi chú", draftCallbackData(revision, "editNote", item.id))],
    [Markup.button.callback("Xóa món", draftCallbackData(revision, "delete", item.id))],
    [Markup.button.callback("← Xem lại đơn", draftCallbackData(revision, "backReview"))],
  ]);
}
