import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../../app";
import type { AuthServicePort } from "../auth.service";
import type { TelegramEmployeeRecord, TelegramEmployeeRepository } from "../telegram-session.types";

const secret = "test-internal-secret";
let server: Server | undefined;

async function startApi(record: TelegramEmployeeRecord | null): Promise<string> {
  const repository: TelegramEmployeeRepository = {
    findByTelegramUserId: async () => record,
  };
  const app = createApp({
    authService: {} as AuthServicePort,
    mountOperationalRoutes: false,
    telegramBotSession: { internalSecret: secret, employeeRepository: repository },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}/api/v1/telegram/bot/session`;
}

async function request(url: string, telegramUserId: unknown, botSecret = secret): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bot-internal-secret": botSecret },
    body: JSON.stringify({ telegramUserId }),
  });
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  server = undefined;
});

describe("POST /api/v1/telegram/bot/session", () => {
  it("returns an active service employee", async () => {
    const url = await startApi({ id: "employee-1", fullName: "Khoa", telegramUserId: 101n, role: "SERVICE_STAFF", status: "ACTIVE" });
    const response = await request(url, 101);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ employeeId: "employee-1", telegramUserId: 101, displayName: "Khoa", role: "SERVICE_STAFF" });
  });

  it("maps a database OWNER to the bot MANAGER role", async () => {
    const url = await startApi({ id: "owner-1", fullName: "Owner", telegramUserId: 102n, role: "OWNER", status: "ACTIVE" });
    const response = await request(url, 102);
    expect(await response.json()).toMatchObject({ role: "MANAGER" });
  });

  it("rejects invalid bot credentials before querying an employee", async () => {
    const url = await startApi(null);
    const response = await request(url, 101, "wrong-secret");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "BOT_AUTH_INVALID", message: "Invalid bot credentials" });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "101"])("rejects invalid Telegram ID %s", async (telegramUserId) => {
    const url = await startApi(null);
    const response = await request(url, telegramUserId);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "TELEGRAM_USER_ID_INVALID" });
  });

  it("returns 404 for an unregistered employee", async () => {
    const url = await startApi(null);
    const response = await request(url, 999);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "EMPLOYEE_NOT_FOUND" });
  });

  it("returns 403 for an inactive employee", async () => {
    const url = await startApi({ id: "employee-2", fullName: "Inactive", telegramUserId: 103n, role: "BARISTA", status: "INACTIVE" });
    const response = await request(url, 103);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "EMPLOYEE_INACTIVE" });
  });
});
