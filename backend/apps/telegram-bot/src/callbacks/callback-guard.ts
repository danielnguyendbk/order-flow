import type { BotSession } from "../types.js";

export type CallbackAcquireResult = "acquired" | "pending" | "processed";

const COMPLETED_CALLBACK_TTL_MS = 5_000;

export function acquireCallback(
  session: BotSession,
  actionKey: string,
  now = Date.now(),
): CallbackAcquireResult {
  pruneCompletedCallbacks(session, now);
  if ((session.pendingCallbacks ?? []).includes(actionKey)) return "pending";
  if ((session.completedCallbacks?.[actionKey] ?? 0) > now) return "processed";
  session.pendingCallbacks = [...new Set([...(session.pendingCallbacks ?? []), actionKey])];
  return "acquired";
}

export function releaseCallback(session: BotSession, actionKey: string): void {
  session.pendingCallbacks = (session.pendingCallbacks ?? []).filter((key) => key !== actionKey);
}

export function markCallbackCompleted(session: BotSession, actionKey: string, now = Date.now()): void {
  session.completedCallbacks = {
    ...(session.completedCallbacks ?? {}),
    [actionKey]: now + COMPLETED_CALLBACK_TTL_MS,
  };
}

function pruneCompletedCallbacks(session: BotSession, now: number): void {
  if (!session.completedCallbacks) return;
  session.completedCallbacks = Object.fromEntries(
    Object.entries(session.completedCallbacks).filter(([, expiresAt]) => expiresAt > now),
  );
}
