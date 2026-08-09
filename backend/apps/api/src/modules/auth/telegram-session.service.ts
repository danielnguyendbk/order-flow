import type {
  TelegramEmployeeRepository,
  TelegramSession,
  TelegramSessionRole,
} from "./telegram-session.types";

export class TelegramSessionError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TelegramSessionError";
  }
}

function toSessionRole(role: "OWNER" | "SERVICE_STAFF" | "BARISTA"): TelegramSessionRole {
  return role === "OWNER" ? "MANAGER" : role;
}

export class TelegramSessionService {
  public constructor(private readonly employees: TelegramEmployeeRepository) {}

  public async authenticate(telegramUserId: number): Promise<TelegramSession> {
    const employee = await this.employees.findByTelegramUserId(telegramUserId);
    if (!employee) {
      throw new TelegramSessionError(404, "EMPLOYEE_NOT_FOUND", "Employee is not registered");
    }
    if (employee.status !== "ACTIVE") {
      throw new TelegramSessionError(403, "EMPLOYEE_INACTIVE", "Employee is inactive");
    }

    return {
      employeeId: employee.id,
      telegramUserId: Number(employee.telegramUserId),
      displayName: employee.fullName,
      role: toSessionRole(employee.role),
    };
  }
}
