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
  /** Recently completed mutation keys. Prevents rapid sequential callback replay. */
  completedCallbacks?: Record<string, number>;
  draftOrder?: DraftOrderSession;
}

export type DraftOrderStep = "CATEGORY" | "ITEM" | "QUANTITY" | "NOTE" | "EDIT_QUANTITY" | "EDIT_NOTE" | "REVIEW";

export interface DraftOrderSession {
  orderId: string;
  callbackRevision: string;
  step: DraftOrderStep;
  categoryId?: string;
  selectedMenuItemId?: string;
  selectedMenuItemName?: string;
  quantity?: number;
  editingOrderItemId?: string;
}

export interface BotContext extends Context {
  session: BotSession;
}
