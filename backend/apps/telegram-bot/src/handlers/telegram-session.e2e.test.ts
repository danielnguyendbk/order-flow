import { createServer, type Server } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTelegramSessionApp } from "../../../api/src/modules/auth/telegram-session.routes";
import type {
  TelegramEmployeeRecord,
  TelegramEmployeeRepository,
} from "../../../api/src/modules/auth/telegram-session.types";
import { BackendClient } from "../api/backend-client.js";
import type { EmployeeSession } from "../types.js";
import { handleCallback, type CallbackHandlerContext } from "./callback.handler.js";
import { handleStart, type StartHandlerContext } from "./start.handler.js";

const internalSecret = "e2e-internal-secret";
let server: Server | undefined;
let records: Map<number, TelegramEmployeeRecord>;
let client: BackendClient;

beforeEach(async () => {
  records = new Map();
  const repository: TelegramEmployeeRepository = {
    findByTelegramUserId: async (telegramUserId) => records.get(telegramUserId) ?? null,
  };
  const app = createTelegramSessionApp({ internalSecret, employeeRepository: repository });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("E2E server did not expose a port");
  client = new BackendClient(`http://127.0.0.1:${address.port}/api/v1`, internalSecret);
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

function activeEmployee(telegramUserId: number, role: "SERVICE_STAFF" | "BARISTA"): TelegramEmployeeRecord {
  return { id: `employee-${telegramUserId}`, fullName: `Employee ${telegramUserId}`, telegramUserId: BigInt(telegramUserId), role, status: "ACTIVE" };
}

function startContext(telegramUserId: number): StartHandlerContext & { replies: Array<[string, unknown?]> } {
  const replies: Array<[string, unknown?]> = [];
  return { from: { id: telegramUserId }, session: {}, replies, reply: async (message, extra) => void replies.push([message, extra]) };
}

function callbackContext(telegramUserId: number, employee: EmployeeSession): CallbackHandlerContext & { answers: string[] } {
  const answers: string[] = [];
  return {
    from: { id: telegramUserId },
    session: { employee },
    callbackId: "callback-e2e",
    callbackData: "service:orders:mine",
    answers,
    reply: async () => undefined,
    answerCallback: async (message) => void answers.push(message ?? ""),
  };
}

describe("Telegram Bot to API session authentication", () => {
  it.each(["SERVICE_STAFF", "BARISTA"] as const)("renders the %s menu from a real HTTP session", async (role) => {
    const telegramUserId = role === "SERVICE_STAFF" ? 701 : 702;
    records.set(telegramUserId, activeEmployee(telegramUserId, role));
    const ctx = startContext(telegramUserId);

    await handleStart(ctx, client);

    expect(ctx.session.employee).toMatchObject({ telegramUserId, role });
    expect(ctx.replies).toHaveLength(1);
    expect(ctx.replies[0][1]).toBeDefined();
  });

  it("blocks an unregistered Telegram user through the real HTTP boundary", async () => {
    const ctx = startContext(799);
    await handleStart(ctx, client);
    expect(ctx.session.employee).toBeUndefined();
    expect(ctx.replies).toHaveLength(1);
  });

  it("blocks the next interaction after an employee becomes inactive", async () => {
    const telegramUserId = 703;
    records.set(telegramUserId, activeEmployee(telegramUserId, "SERVICE_STAFF"));
    const start = startContext(telegramUserId);
    await handleStart(start, client);
    const authenticated = start.session.employee!;

    records.set(telegramUserId, { ...records.get(telegramUserId)!, status: "INACTIVE" });
    const callback = callbackContext(telegramUserId, authenticated);
    await handleCallback(callback, client);

    expect(callback.session.employee).toBeUndefined();
    expect(callback.answers).toHaveLength(1);
  });
});
