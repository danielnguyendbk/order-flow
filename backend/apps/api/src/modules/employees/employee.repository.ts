import type { Pool } from "pg";

import type {
  CreateEmployeeInput,
  Employee,
  EmployeeFilters,
  EmployeeRole,
  EmployeeStatus,
  PaginatedEmployees,
  UpdateEmployeeInput,
} from "./employee.types.js";

interface EmployeeRow {
  id: string;
  full_name: string;
  telegram_user_id: string;
  telegram_chat_id: string | null;
  username: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, full_name, telegram_user_id, telegram_chat_id,
  username, role, status, created_at, updated_at`;

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    fullName: row.full_name,
    telegramUserId: row.telegram_user_id,
    telegramChatId: row.telegram_chat_id,
    username: row.username,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EmployeeRepositoryPort {
  findAll(filters: EmployeeFilters): Promise<PaginatedEmployees>;
  findById(id: string): Promise<Employee | null>;
  create(input: CreateEmployeeInput): Promise<Employee>;
  update(id: string, input: UpdateEmployeeInput): Promise<Employee | null>;
  setStatus(id: string, status: EmployeeStatus): Promise<Employee | null>;
}

export class EmployeeRepository implements EmployeeRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findAll(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    const conditions = ["role in ('SERVICE_STAFF', 'BARISTA')"];
    const values: unknown[] = [];
    const add = (condition: string, value: unknown) => {
      values.push(value);
      conditions.push(condition.replace("?", `$${values.length}`));
    };
    if (filters.search) {
      const term = `%${filters.search}%`;
      values.push(term, term);
      conditions.push(
        `(full_name ilike $${values.length - 1} or username ilike $${values.length})`,
      );
    }
    if (filters.role) add("role = ?", filters.role);
    if (filters.status) add("status = ?", filters.status);

    const where = `where ${conditions.join(" and ")}`;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, count] = await Promise.all([
      this.pool.query<EmployeeRow>(
        `select ${COLUMNS} from public.users ${where}
         order by created_at desc limit $${values.length + 1} offset $${values.length + 2}`,
        [...values, filters.limit, offset],
      ),
      this.pool.query<{ total: string }>(
        `select count(*)::text as total from public.users ${where}`,
        values,
      ),
    ]);
    const total = Number(count.rows[0]?.total ?? 0);
    return {
      data: rows.rows.map(mapEmployee),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findById(id: string): Promise<Employee | null> {
    const result = await this.pool.query<EmployeeRow>(
      `select ${COLUMNS} from public.users
       where id = $1 and role in ('SERVICE_STAFF', 'BARISTA') limit 1`,
      [id],
    );
    return result.rows[0] ? mapEmployee(result.rows[0]) : null;
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const result = await this.pool.query<EmployeeRow>(
      `insert into public.users
        (full_name, telegram_user_id, telegram_chat_id, username, role)
       values ($1, $2, $3, $4, $5)
       returning ${COLUMNS}`,
      [
        input.fullName,
        input.telegramUserId,
        input.telegramChatId ?? null,
        input.username ?? null,
        input.role,
      ],
    );
    return mapEmployee(result.rows[0]!);
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<Employee | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };
    if (input.fullName !== undefined) add("full_name", input.fullName);
    if (input.telegramUserId !== undefined) add("telegram_user_id", input.telegramUserId);
    if (input.telegramChatId !== undefined) add("telegram_chat_id", input.telegramChatId);
    if (input.username !== undefined) add("username", input.username);
    if (input.role !== undefined) add("role", input.role);
    values.push(id);
    const result = await this.pool.query<EmployeeRow>(
      `update public.users set ${fields.join(", ")}
       where id = $${values.length} and role in ('SERVICE_STAFF', 'BARISTA')
       returning ${COLUMNS}`,
      values,
    );
    return result.rows[0] ? mapEmployee(result.rows[0]) : null;
  }

  async setStatus(id: string, status: EmployeeStatus): Promise<Employee | null> {
    const result = await this.pool.query<EmployeeRow>(
      `update public.users set status = $1
       where id = $2 and role in ('SERVICE_STAFF', 'BARISTA')
       returning ${COLUMNS}`,
      [status, id],
    );
    return result.rows[0] ? mapEmployee(result.rows[0]) : null;
  }
}
