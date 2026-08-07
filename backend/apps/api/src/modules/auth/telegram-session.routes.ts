import { createHash, timingSafeEqual } from "node:crypto";

import express, { Router, json, type Application, type Request, type Response } from "express";

import { PrismaTelegramEmployeeRepository } from "./telegram-session.repository";
import { TelegramSessionError, TelegramSessionService } from "./telegram-session.service";
import type { TelegramEmployeeRepository } from "./telegram-session.types";

export function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function errorResponse(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message });
}

export interface TelegramSessionRouterOptions {
  internalSecret: string;
  employeeRepository?: TelegramEmployeeRepository;
}

export function createTelegramSessionRouter(options: TelegramSessionRouterOptions): Router {
  if (!options.internalSecret) throw new Error("BOT_INTERNAL_SECRET is required");

  const router = Router();
  router.use(json());
  const service = new TelegramSessionService(
    options.employeeRepository ?? new PrismaTelegramEmployeeRepository(),
  );

  router.post("/session", async (req: Request, res: Response) => {
    const providedSecret = req.header("x-bot-internal-secret");
    if (!secretMatches(providedSecret, options.internalSecret)) {
      errorResponse(res, 401, "BOT_AUTH_INVALID", "Invalid bot credentials");
      return;
    }

    const telegramUserId = req.body?.telegramUserId;
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
      errorResponse(res, 400, "TELEGRAM_USER_ID_INVALID", "telegramUserId must be a positive safe integer");
      return;
    }

    try {
      res.json(await service.authenticate(telegramUserId));
    } catch (error) {
      if (error instanceof TelegramSessionError) {
        errorResponse(res, error.statusCode, error.code, error.message);
        return;
      }
      throw error;
    }
  });

  return router;
}

export function createTelegramSessionApp(options: TelegramSessionRouterOptions): Application {
  const app = express();
  app.use("/api/v1/telegram", createTelegramSessionRouter(options));
  return app;
}
