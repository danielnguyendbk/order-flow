import { describe, expect, it, vi } from "vitest";

import { BackendApiError } from "../api/backend-client.js";
import type { EmployeeAuthenticationApi } from "../auth/employee-auth.js";
import type { EmployeeSession } from "../types.js";
import { handleCallback, type CallbackHandlerContext } from "./callback.handler.js";
import { handleStart, type StartHandlerContext } from "./start.handler.js";

const serviceStaff: EmployeeSession = {
  employeeId: "employee-service",
  telegramUserId: 101,
  displayName: "Minh Anh",
  role: "SERVICE_STAFF",
};

const barista: EmployeeSession = {
  employeeId: "employee-barista",
  telegramUserId: 202,
  displayName: "Thu Hà",
  role: "BARISTA",
};

function apiReturning(employee: EmployeeSession): EmployeeAuthenticationApi {
  return { createTelegramSession: vi.fn().mockResolvedValue(employee) };
}

function startContext(telegramUserId: number): StartHandlerContext & { replies: Array<[string, unknown?]> } {
  const replies: Array<[string, unknown?]> = [];
  return {
    from: { id: telegramUserId },
    session: {},
    replies,
    reply: async (message, extra) => void replies.push([message, extra]),
  };
}

function callbackContext(data: string, telegramUserId: number): CallbackHandlerContext & { answers: string[]; replies: string[] } {
  const answers: string[] = [];
  const replies: string[] = [];
  return {
    from: { id: telegramUserId },
    session: {},
    callbackId: "callback-1",
    callbackData: data,
    answers,
    replies,
    answerCallback: async (message) => void answers.push(message ?? ""),
    reply: async (message) => void replies.push(message),
  };
}

function buttonLabels(extra: unknown): string[] {
  const keyboard = (extra as { reply_markup: { inline_keyboard: Array<Array<{ text: string }>> } }).reply_markup.inline_keyboard;
  return keyboard.flat().map((button) => button.text);
}

describe("Telegram authentication and role menu", () => {
  it("stores the service-staff session and displays its menu", async () => {
    const ctx = startContext(serviceStaff.telegramUserId);
    await handleStart(ctx, apiReturning(serviceStaff));

    expect(ctx.session.employee).toEqual(serviceStaff);
    expect(buttonLabels(ctx.replies[0][1])).toEqual(["Tạo đơn", "Đơn của tôi"]);
  });

  it("stores the barista session and displays its menu", async () => {
    const ctx = startContext(barista.telegramUserId);
    await handleStart(ctx, apiReturning(barista));

    expect(ctx.session.employee).toEqual(barista);
    expect(buttonLabels(ctx.replies[0][1])).toEqual(["Đơn chờ pha chế", "Lịch sử pha chế"]);
  });

  it.each([401, 403, 404])("blocks an unregistered or inactive employee (%i)", async (status) => {
    const ctx = startContext(serviceStaff.telegramUserId);
    const api: EmployeeAuthenticationApi = {
      createTelegramSession: vi.fn().mockRejectedValue(new BackendApiError("Denied", status, "EMPLOYEE_INACTIVE")),
    };

    await handleStart(ctx, api);

    expect(ctx.replies[0][0]).toContain("chưa được đăng ký hoặc đã bị vô hiệu hóa");
    expect(ctx.session.employee).toBeUndefined();
  });

  it("rejects a callback when the authenticated role does not match its menu action", async () => {
    const ctx = callbackContext("barista:queue", serviceStaff.telegramUserId);
    await handleCallback(ctx, apiReturning(serviceStaff));

    expect(ctx.answers).toEqual(["Thao tác không còn hợp lệ."]);
    expect(ctx.replies).toEqual([]);
  });

  it("rejects a stale callback and re-checks an inactive employee", async () => {
    const stale = callbackContext("service:order:removed", serviceStaff.telegramUserId);
    await handleCallback(stale, apiReturning(serviceStaff));
    expect(stale.answers).toEqual(["Thao tác không còn hợp lệ."]);

    const inactive = callbackContext("service:order:create", serviceStaff.telegramUserId);
    const api: EmployeeAuthenticationApi = {
      createTelegramSession: vi.fn().mockRejectedValue(new BackendApiError("Inactive", 403, "EMPLOYEE_INACTIVE")),
    };
    await handleCallback(inactive, api);
    expect(inactive.answers).toEqual(["Tài khoản không còn được phép sử dụng."]);
  });
});
