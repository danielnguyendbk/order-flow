import type { Pool } from "pg";

import type { AuthUser, AuthUserWithPassword, UserRole } from "./auth.types.js";

interface UserRow {
  id: string;
  full_name: string;
  username: string | null;
  telegram_user_id: string | null;
  password_hash: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
}

function mapUser(row: UserRow): AuthUserWithPassword {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    telegramUserId: row.telegram_user_id,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
  };
}

export interface AuthRepositoryPort {
  findAdminByUsername(username: string): Promise<AuthUserWithPassword | null>;
  findTelegramUser(telegramUserId: string): Promise<AuthUser | null>;
  findUserById(userId: string): Promise<AuthUser | null>;
}

export class AuthRepository implements AuthRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findAdminByUsername(username: string): Promise<AuthUserWithPassword | null> {
    const result = await this.pool.query<UserRow>(
      `select id, full_name, username, telegram_user_id, password_hash, role, status
        from public.users
        where lower(username) = lower($1) and role in ('OWNER', 'SERVICE_STAFF')
        limit 1`,
      [username],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findTelegramUser(telegramUserId: string): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `select id, full_name, username, telegram_user_id, password_hash, role, status
       from public.users
       where telegram_user_id = $1
       limit 1`,
      [telegramUserId],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserById(userId: string): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `select id, full_name, username, telegram_user_id, password_hash, role, status
       from public.users
       where id = $1
       limit 1`,
      [userId],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
}
