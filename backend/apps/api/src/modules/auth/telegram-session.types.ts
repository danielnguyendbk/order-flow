export type DatabaseEmployeeRole = "OWNER" | "SERVICE_STAFF" | "BARISTA";
export type TelegramSessionRole = "MANAGER" | "SERVICE_STAFF" | "BARISTA";

export interface TelegramEmployeeRecord {
  id: string;
  fullName: string;
  telegramUserId: bigint;
  role: DatabaseEmployeeRole;
  status: "ACTIVE" | "INACTIVE";
}

export interface TelegramSession {
  employeeId: string;
  telegramUserId: number;
  displayName: string;
  role: TelegramSessionRole;
}

export interface TelegramEmployeeRepository {
  findByTelegramUserId(telegramUserId: number): Promise<TelegramEmployeeRecord | null>;
}
