export type EmployeeRole = "SERVICE_STAFF" | "BARISTA";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export interface Employee {
  id: string;
  fullName: string;
  telegramUserId: string;
  telegramChatId: string | null;
  username: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeFilters {
  page: number;
  limit: number;
  search?: string;
  role?: EmployeeRole;
  status?: EmployeeStatus;
}

export interface CreateEmployeeInput {
  fullName: string;
  telegramUserId: string;
  telegramChatId?: string | null;
  username?: string | null;
  role: EmployeeRole;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export interface PaginatedEmployees {
  data: Employee[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

