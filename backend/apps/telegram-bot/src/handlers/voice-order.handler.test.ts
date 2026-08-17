import { describe, expect, it, vi } from "vitest";

import type { BackendApi } from "../api/backend-client.js";
import type { DraftOrder } from "../api/order-types.js";
import type { EmployeeSession } from "../types.js";
import { handleVoiceOrder, type VoiceOrderIntake } from "./voice-order.handler.js";

const employee: EmployeeSession = {
  employeeId: "employee-1",
  telegramUserId: 7377655343,
  displayName: "Nhân",
  role: "SERVICE_STAFF",
};

const draft: DraftOrder = {
  id: "order-1",
  code: "ORD-001",
  paymentStatus: "UNPAID",
  fulfillmentStatus: "PENDING_PAYMENT",
  totalAmount: 85_000,
  items: [
    { id: "line-1", menuItemId: "coffee", name: "Cà phê sữa đá", quantity: 1, unitPrice: 35_000, note: null },
    { id: "line-2", menuItemId: "bread", name: "Bánh mì que", quantity: 2, unitPrice: 25_000, note: null },
  ],
};

function api(): BackendApi {
  return {
    createTelegramSession: vi.fn().mockResolvedValue(employee),
    createDraftOrder: vi.fn().mockResolvedValue(draft),
    getMenuCategories: vi.fn(),
    getMenuItems: vi.fn(),
    addDraftOrderItem: vi.fn(),
    updateDraftOrderItem: vi.fn(),
    deleteDraftOrderItem: vi.fn(),
    getDraftOrder: vi.fn().mockResolvedValue(draft),
    cancelDraftOrder: vi.fn(),
    listMyOrders: vi.fn(),
    confirmCashPayment: vi.fn(),
    createQrPayment: vi.fn(),
    deliverOrder: vi.fn(),
    listBaristaQueue: vi.fn(),
    listBaristaOrders: vi.fn(),
    getBaristaOrder: vi.fn(),
    getBaristaOrderHistory: vi.fn(),
    claimBaristaOrder: vi.fn(),
    markBaristaOrderReady: vi.fn(),
  };
}

describe("voice order intake", () => {
  it("creates the draft through the intake command and renders the existing review keyboard", async () => {
    const replies: Array<{ message: string; extra?: unknown }> = [];
    const session = {};
    const intake: VoiceOrderIntake = {
      createDraftFromVoice: vi.fn().mockResolvedValue({ transcript: "một cà phê sữa và hai bánh mì que" }),
    };
    const backend = api();
    const ctx = {
      from: { id: employee.telegramUserId },
      session,
      voiceFileId: "voice-file-1",
      getVoiceFileUrl: vi.fn().mockResolvedValue(new URL("https://api.telegram.org/file/bot-redacted/voice.ogg")),
      reply: async (message: string, extra?: unknown) => void replies.push({ message, extra }),
    };

    await handleVoiceOrder(ctx, backend, intake);

    expect(intake.createDraftFromVoice).toHaveBeenCalledWith({
      audioUrl: "https://api.telegram.org/file/bot-redacted/voice.ogg",
      telegramUserId: employee.telegramUserId,
    });
    expect(ctx.session).toMatchObject({ draftOrder: { orderId: draft.id, step: "REVIEW" } });
    expect(replies.at(-1)?.message).toContain("ĐƠN ORD-001");
    const labels = (replies.at(-1)?.extra as { reply_markup: { inline_keyboard: Array<Array<{ text: string }>> } })
      .reply_markup.inline_keyboard.flat().map((button) => button.text);
    expect(labels).toEqual([
      "Tiền mặt",
      "QR",
      "➕ Thêm món",
      "✏️ 1 × Cà phê sữa đá",
      "✏️ 2 × Bánh mì que",
      "❌ Hủy đơn",
    ]);
  });

  it("does not render a review when the intake command fails", async () => {
    const replies: string[] = [];
    const intake: VoiceOrderIntake = {
      createDraftFromVoice: vi.fn().mockRejectedValue(new Error("intake failed")),
    };
    const backend = api();
    const ctx = {
      from: { id: employee.telegramUserId },
      session: {},
      voiceFileId: "voice-file-1",
      getVoiceFileUrl: vi.fn().mockResolvedValue(new URL("https://api.telegram.org/file/bot-redacted/voice.ogg")),
      reply: async (message: string) => void replies.push(message),
    };

    await handleVoiceOrder(ctx, backend, intake);

    expect(backend.createDraftOrder).not.toHaveBeenCalled();
    expect(replies.at(-1)).toBe("Không thể tạo đơn từ tin nhắn thoại. Vui lòng thử lại hoặc nhập đơn bằng nút Tạo đơn.");
  });
});
