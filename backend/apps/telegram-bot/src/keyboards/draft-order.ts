import { Markup } from "telegraf";

import type { DraftOrder, DraftOrderItem, MenuCategory, MenuItem } from "../api/order-types.js";

export function categoryKeyboard(categories: MenuCategory[]) {
  return Markup.inlineKeyboard([
    ...categories.map((category) => [Markup.button.callback(category.name, `draft:category:${category.id}`)]),
    [Markup.button.callback("Hủy tạo đơn", "draft:cancel")],
  ]);
}

export function itemKeyboard(items: MenuItem[]) {
  return Markup.inlineKeyboard([
    ...items.filter((item) => item.isActive).map((item) => [Markup.button.callback(item.name, `draft:item:${item.id}`)]),
    [Markup.button.callback("← Danh mục", "draft:back:categories"), Markup.button.callback("Hủy", "draft:cancel")],
  ]);
}

export function noteKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Bỏ qua ghi chú", "draft:note:skip"), Markup.button.callback("Hủy", "draft:cancel")]]);
}

export function reviewKeyboard(order: DraftOrder) {
  return Markup.inlineKeyboard([
    ...(order.items.length ? [[
      Markup.button.callback("Tiền mặt", "draft:pay:cash"),
      Markup.button.callback("QR", "draft:pay:qr"),
    ]] : []),
    [Markup.button.callback("Thêm món", "draft:add-more")],
    ...order.items.map((item) => [Markup.button.callback(`Sửa: ${item.name}`, `draft:edit:${item.id}`)]),
    [Markup.button.callback("Hủy đơn", "draft:cancel")],
  ]);
}

export function editItemKeyboard(item: DraftOrderItem) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Sửa số lượng", `draft:edit-quantity:${item.id}`)],
    [Markup.button.callback("Sửa ghi chú", `draft:edit-note:${item.id}`)],
    [Markup.button.callback("Xóa món", `draft:delete:${item.id}`)],
    [Markup.button.callback("← Xem lại đơn", "draft:back:review")],
  ]);
}
