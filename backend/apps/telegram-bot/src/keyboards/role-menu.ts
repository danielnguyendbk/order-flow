import { Markup } from "telegraf";

import type { EmployeeRole } from "../types.js";

export const SERVICE_STAFF_QUICK_ACTIONS = {
  order: "🛒 Tạo đơn",
  cart: "🧾 Đơn đang tạo",
  orders: "📋 Đơn gần đây",
  menu: "🏠 Menu",
} as const;

export const BARISTA_QUICK_ACTIONS = {
  queue: "☕ Hàng đợi",
  active: "🔥 Đang pha",
  orders: "📋 Đơn của tôi",
  menu: "🏠 Menu",
} as const;

export function serviceStaffQuickKeyboard() {
  return Markup.keyboard([
    [Markup.button.text(SERVICE_STAFF_QUICK_ACTIONS.order), Markup.button.text(SERVICE_STAFF_QUICK_ACTIONS.cart)],
    [Markup.button.text(SERVICE_STAFF_QUICK_ACTIONS.orders), Markup.button.text(SERVICE_STAFF_QUICK_ACTIONS.menu)],
  ]).resize().persistent().placeholder("Chọn thao tác nhanh");
}

export function baristaQuickKeyboard() {
  return Markup.keyboard([
    [Markup.button.text(BARISTA_QUICK_ACTIONS.queue), Markup.button.text(BARISTA_QUICK_ACTIONS.active)],
    [Markup.button.text(BARISTA_QUICK_ACTIONS.orders), Markup.button.text(BARISTA_QUICK_ACTIONS.menu)],
  ]).resize().persistent().placeholder("Chọn thao tác pha chế");
}

export function roleMenu(role: EmployeeRole) {
  if (role === "SERVICE_STAFF") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🛒 Tạo đơn", "service:order:create")],
      [Markup.button.callback("📋 Đơn gần đây", "service:orders:mine")],
    ]);
  }

  if (role === "BARISTA") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("☕ Hàng đợi", "barista:queue"), Markup.button.callback("🔥 Đang pha", "barista:active")],
      [Markup.button.callback("📋 Đơn của tôi", "barista:orders:mine")],
    ]);
  }

  return Markup.inlineKeyboard([[Markup.button.callback("Mở trang quản trị", "manager:admin")]]);
}
