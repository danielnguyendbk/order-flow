import type { BackendApi } from "../api/backend-client.js";
import type { BotSession, EmployeeSession } from "../types.js";

export class MissingTelegramIdentityError extends Error {
  public constructor() {
    super("Telegram user ID is unavailable");
    this.name = "MissingTelegramIdentityError";
  }
}

export interface EmployeeAuthContext {
  from?: { id: number };
  session: BotSession;
}

export async function authenticateEmployee(
  ctx: EmployeeAuthContext,
  api: BackendApi,
): Promise<EmployeeSession> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) throw new MissingTelegramIdentityError();

  // Re-authenticate every interaction: an employee may have been deactivated
  // after the bot session was created. Clear any prior session first so it can
  // never be reused after an inactive/unknown response.
  ctx.session.employee = undefined;
  const employee = await api.createTelegramSession(telegramUserId);
  if (employee.telegramUserId !== telegramUserId) {
    throw new Error("Telegram session response does not match the current user");
  }
  ctx.session.employee = employee;
  return employee;
}
