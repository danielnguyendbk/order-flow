import { describe, expect, it, vi } from "vitest";

import { BackendApiError, type BackendApi } from "../api/backend-client.js";
import type { DraftOrder } from "../api/order-types.js";
import type { EmployeeSession } from "../types.js";
import { showMyOrders, showOrderStatus, type OrderStatusContext } from "./order-status.handler.js";

const employee: EmployeeSession = {
  employeeId: "employee-1",
  telegramUserId: 1001,
  displayName: "Khoa",
  role: "SERVICE_STAFF",
};

function order(overrides: Partial<DraftOrder> = {}): DraftOrder {
  return {
    id: "order-1",
    code: "ORD-001",
    paymentMethod: "QR",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING_PAYMENT",
    totalAmount: 30_000,
    items: [],
    ...overrides,
  };
}

function api(overrides: Partial<BackendApi> = {}): BackendApi {
  return {
    createTelegramSession: vi.fn().mockResolvedValue(employee),
    createDraftOrder: vi.fn().mockResolvedValue(order()),
    getMenuCategories: vi.fn().mockResolvedValue([]),
    getMenuItems: vi.fn().mockResolvedValue([]),
    addDraftOrderItem: vi.fn().mockResolvedValue(order()),
    updateDraftOrderItem: vi.fn().mockResolvedValue(order()),
    deleteDraftOrderItem: vi.fn().mockResolvedValue(order()),
    getDraftOrder: vi.fn().mockResolvedValue(order()),
    cancelDraftOrder: vi.fn().mockResolvedValue(undefined),
    listMyOrders: vi.fn().mockResolvedValue([order()]),
    confirmCashPayment: vi.fn().mockResolvedValue(order()),
    createQrPayment: vi.fn().mockResolvedValue({ order: order(), paymentCode: "PAYORD001", amount: 30_000, qrImageUrl: "https://vietqr.app/img" }),
    ...overrides,
  };
}

function context(): OrderStatusContext & { replies: string[] } {
  const replies: string[] = [];
  return { from: { id: employee.telegramUserId }, session: { employee }, replies, reply: async (message) => void replies.push(message) };
}

describe("Telegram order tracking", () => {
  it("lists only the authenticated employee's orders", async () => {
    const backend = api();
    const ctx = context();
    await showMyOrders(ctx, backend);
    expect(backend.listMyOrders).toHaveBeenCalledWith(employee.telegramUserId);
    expect(ctx.replies).toEqual(["Chọn đơn để xem trạng thái:"]);
  });

  it("refreshes payment and fulfillment status from the backend", async () => {
    const backend = api({ getDraftOrder: vi.fn().mockResolvedValue(order({ paymentStatus: "PAID", fulfillmentStatus: "QUEUED" })) });
    const ctx = context();
    await showOrderStatus(ctx, backend, "order-1");
    expect(backend.getDraftOrder).toHaveBeenCalledWith(employee.telegramUserId, "order-1");
    expect(ctx.replies[0]).toContain("PAID");
    expect(ctx.replies[0]).toContain("QUEUED");
  });

  it("blocks tracking on the next interaction after deactivation", async () => {
    const backend = api({
      createTelegramSession: vi.fn().mockRejectedValue(new BackendApiError("Inactive", 403, "EMPLOYEE_INACTIVE")),
    });
    const ctx = context();
    await showOrderStatus(ctx, backend, "order-1");
    expect(ctx.session.employee).toBeUndefined();
    expect(backend.getDraftOrder).not.toHaveBeenCalled();
  });
});
