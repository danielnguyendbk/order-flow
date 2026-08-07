import type { NextFunction, Request, Response } from "express";

import { PrismaTelegramEmployeeRepository } from "./telegram-session.repository";
import { secretMatches } from "./telegram-session.routes";
import type {
  DatabaseEmployeeRole,
  TelegramEmployeeRecord,
  TelegramEmployeeRepository,
} from "./telegram-session.types";

export const TELEGRAM_EMPLOYEE_LOCAL = "telegramEmployee";

export interface TelegramRequestAuthOptions {
  internalSecret: string;
  employeeRepository?: TelegramEmployeeRepository;
  passThroughWithoutBotHeaders?: boolean;
  roles?: DatabaseEmployeeRole[];
}

export function getTelegramEmployee(res: Response): TelegramEmployeeRecord {
  return res.locals[TELEGRAM_EMPLOYEE_LOCAL] as TelegramEmployeeRecord;
}

export function createRequireTelegramEmployee(options: TelegramRequestAuthOptions) {
  if (!options.internalSecret) throw new Error("BOT_INTERNAL_SECRET is required");
  const employees = options.employeeRepository ?? new PrismaTelegramEmployeeRepository();
  const roles = options.roles ?? ["OWNER", "SERVICE_STAFF", "BARISTA"];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (options.passThroughWithoutBotHeaders && !req.header("x-bot-internal-secret") && !req.header("x-telegram-user-id")) {
      next("route");
      return;
    }
    if (!secretMatches(req.header("x-bot-internal-secret"), options.internalSecret)) {
      res.status(401).json({ code: "BOT_AUTH_INVALID", message: "Invalid bot credentials" });
      return;
    }

    const rawTelegramUserId = req.header("x-telegram-user-id");
    const telegramUserId = rawTelegramUserId && /^[1-9]\d*$/.test(rawTelegramUserId) ? Number(rawTelegramUserId) : NaN;
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
      res.status(400).json({ code: "TELEGRAM_USER_ID_INVALID", message: "x-telegram-user-id must be a positive safe integer" });
      return;
    }

    try {
      const employee = await employees.findByTelegramUserId(telegramUserId);
      if (!employee) {
        res.status(404).json({ code: "EMPLOYEE_NOT_FOUND", message: "Employee is not registered" });
        return;
      }
      if (employee.status !== "ACTIVE") {
        res.status(403).json({ code: "EMPLOYEE_INACTIVE", message: "Employee is inactive" });
        return;
      }
      if (!roles.includes(employee.role)) {
        res.status(403).json({ code: "ROLE_FORBIDDEN", message: `One of these roles is required: ${roles.join(", ")}` });
        return;
      }

      res.locals[TELEGRAM_EMPLOYEE_LOCAL] = employee;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireServiceStaff(options: TelegramRequestAuthOptions) {
  return createRequireTelegramEmployee({ ...options, roles: ["SERVICE_STAFF"] });
}

export function createRequireBarista(options: TelegramRequestAuthOptions) {
  return createRequireTelegramEmployee({ ...options, roles: ["BARISTA"] });
}
