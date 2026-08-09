import { randomBytes } from "node:crypto";

export const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;

export type DraftCallbackAction =
  | "category"
  | "item"
  | "cancel"
  | "addMore"
  | "backCategories"
  | "backReview"
  | "skipNote"
  | "payCash"
  | "payQr"
  | "edit"
  | "editQuantity"
  | "editNote"
  | "delete";

const ACTION_CODES: Record<DraftCallbackAction, string> = {
  category: "c",
  item: "i",
  cancel: "x",
  addMore: "a",
  backCategories: "b",
  backReview: "r",
  skipNote: "s",
  payCash: "pc",
  payQr: "pq",
  edit: "e",
  editQuantity: "q",
  editNote: "n",
  delete: "z",
};

const CODE_ACTIONS = Object.fromEntries(
  Object.entries(ACTION_CODES).map(([action, code]) => [code, action]),
) as Record<string, DraftCallbackAction>;

const ENTITY_ACTIONS = new Set<DraftCallbackAction>([
  "category",
  "item",
  "edit",
  "editQuantity",
  "editNote",
  "delete",
]);

export interface ParsedDraftCallback {
  revision: string;
  action: DraftCallbackAction;
  entityId?: string;
}

export function createCallbackRevision(): string {
  return randomBytes(4).toString("hex");
}

export function draftCallbackData(revision: string, action: DraftCallbackAction, entityId?: string): string {
  if (!/^[a-f0-9]{8}$/.test(revision)) throw new Error("Draft callback revision must contain 8 lowercase hex characters");
  if (ENTITY_ACTIONS.has(action) !== Boolean(entityId)) throw new Error(`Invalid entity for draft callback action ${action}`);
  return assertTelegramCallbackData(`d:${revision}:${ACTION_CODES[action]}${entityId ? `:${entityId}` : ""}`);
}

export function parseDraftCallbackData(data: string): ParsedDraftCallback | undefined {
  const match = /^d:([a-f0-9]{8}):([a-z]{1,2})(?::(.+))?$/.exec(data);
  if (!match) return undefined;
  const action = CODE_ACTIONS[match[2]];
  if (!action || ENTITY_ACTIONS.has(action) !== Boolean(match[3])) return undefined;
  return { revision: match[1], action, ...(match[3] ? { entityId: match[3] } : {}) };
}

export function assertTelegramCallbackData(data: string): string {
  if (Buffer.byteLength(data, "utf8") > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`Telegram callback_data exceeds ${TELEGRAM_CALLBACK_DATA_MAX_BYTES} bytes`);
  }
  return data;
}
