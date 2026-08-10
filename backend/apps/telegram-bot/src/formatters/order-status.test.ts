import { describe, expect, it } from "vitest";

import {
  fulfillmentStatusLabel,
  orderStatusSummary,
  paymentStatusLabel,
  statusDomainLabel,
  statusTransitionLabel,
} from "./order-status.js";

describe("Vietnamese order status labels", () => {
  it.each([
    ["UNPAID", "Chưa thanh toán"],
    ["PENDING", "Chờ xác nhận thanh toán"],
    ["PAID", "Đã thanh toán"],
    ["UNDERPAID", "Thanh toán thiếu"],
    ["OVERPAID", "Thanh toán thừa"],
    ["REVIEW", "Cần kiểm tra thanh toán"],
  ])("translates payment status %s", (status, label) => {
    expect(paymentStatusLabel(status)).toBe(label);
  });

  it.each([
    ["PENDING_PAYMENT", "Chờ thanh toán"],
    ["QUEUED", "Chờ pha"],
    ["PREPARING", "Đang pha chế"],
    ["READY", "Sẵn sàng giao"],
    ["DELIVERED", "Đã giao"],
    ["CANCELLED", "Đã hủy"],
  ])("translates fulfillment status %s", (status, label) => {
    expect(fulfillmentStatusLabel(status)).toBe(label);
  });

  it("translates summaries, history domains and transitions", () => {
    expect(orderStatusSummary("PAID", "QUEUED")).toBe("Đã thanh toán · Chờ pha");
    expect(statusDomainLabel("PAYMENT")).toBe("Thanh toán");
    expect(statusDomainLabel("FULFILLMENT")).toBe("Pha chế");
    expect(statusTransitionLabel("PAYMENT", "PENDING")).toBe("Chờ xác nhận thanh toán");
    expect(statusTransitionLabel("FULFILLMENT", "READY")).toBe("Sẵn sàng giao");
  });
});
