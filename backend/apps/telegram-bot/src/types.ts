import type { Context } from "telegraf";

export type EmployeeRole = "SERVICE_STAFF" | "BARISTA" | "MANAGER";

export interface EmployeeSession {
  employeeId: string;
  telegramUserId: number;
  displayName: string;
  role: EmployeeRole;
}

export interface BotSession {
  employee?: EmployeeSession;
  /** Callback IDs currently being processed. Prevents accidental double taps. */
  pendingCallbacks?: string[];
}

export interface BotContext extends Context {
  session: BotSession;
}
