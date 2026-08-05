import { PrismaClient } from "@prisma/client";

import type { TelegramEmployeeRecord, TelegramEmployeeRepository } from "./telegram-session.types";

type RawEmployeeRow = {
  id: string;
  full_name: string;
  telegram_user_id: bigint;
  role: "OWNER" | "SERVICE_STAFF" | "BARISTA";
  status: "ACTIVE" | "INACTIVE";
};

export interface RawQueryClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export class PrismaTelegramEmployeeRepository implements TelegramEmployeeRepository {
  public constructor(private readonly database: RawQueryClient = new PrismaClient()) {}

  public async findByTelegramUserId(telegramUserId: number): Promise<TelegramEmployeeRecord | null> {
    const rows = await this.database.$queryRaw<RawEmployeeRow[]>`
      SELECT id, full_name, telegram_user_id, role::text AS role, status::text AS status
      FROM public.users
      WHERE telegram_user_id = ${BigInt(telegramUserId)}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      fullName: row.full_name,
      telegramUserId: row.telegram_user_id,
      role: row.role,
      status: row.status,
    };
  }
}
