import { Markup } from "telegraf";

import type { EmployeeRole } from "../types.js";

export function roleMenu(role: EmployeeRole) {
  if (role === "SERVICE_STAFF") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Tạo đơn", "service:order:create")],
      [Markup.button.callback("Đơn của tôi", "service:orders:mine")],
    ]);
  }

  if (role === "BARISTA") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Đơn chờ pha chế", "barista:queue")],
      [Markup.button.callback("Lịch sử pha chế", "barista:orders:mine")],
    ]);
  }

  return Markup.inlineKeyboard([[Markup.button.callback("Mở trang quản trị", "manager:admin")]]);
}
