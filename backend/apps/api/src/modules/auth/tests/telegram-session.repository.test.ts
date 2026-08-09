import { describe, expect, it, vi } from "vitest";

import { PrismaTelegramEmployeeRepository, type RawQueryClient } from "../telegram-session.repository";

describe("PrismaTelegramEmployeeRepository", () => {
  it("uses a parameterized raw query and maps the users row", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: "employee-1", full_name: "Khoa", telegram_user_id: 123n, role: "BARISTA", status: "ACTIVE" }]);
    const repository = new PrismaTelegramEmployeeRepository({ $queryRaw: queryRaw } as RawQueryClient);

    await expect(repository.findByTelegramUserId(123)).resolves.toEqual({ id: "employee-1", fullName: "Khoa", telegramUserId: 123n, role: "BARISTA", status: "ACTIVE" });
    expect(queryRaw).toHaveBeenCalledOnce();
    const [strings, value] = queryRaw.mock.calls[0];
    expect(strings.join("?")).toContain("WHERE telegram_user_id = ?");
    expect(value).toBe(123n);
  });
});
