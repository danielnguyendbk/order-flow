import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import type { AuthServicePort } from "./auth.service.js";
import {
  adminLoginSchema,
  refreshSchema,
  telegramSessionSchema,
} from "./auth.schemas.js";

function metadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  };
}

export class AuthController {
  constructor(private readonly authService: AuthServicePort) {}

  telegramSession = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = telegramSessionSchema.parse(request.body);
      const session = await this.authService.createTelegramSession(
        input.initData,
        metadata(request),
      );
      response.status(201).json({ data: session });
    } catch (error) {
      next(error);
    }
  };

  adminLogin = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = adminLoginSchema.parse(request.body);
      const session = await this.authService.loginAdmin(
        input.username,
        input.password,
        metadata(request),
      );
      response.status(200).json({ data: session });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = refreshSchema.parse(request.body);
      response.status(200).json({
        data: await this.authService.refresh(input.refreshToken),
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.auth) throw new AppError("UNAUTHORIZED", "Authentication required");
      await this.authService.logout(request.auth);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  me = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.auth) throw new AppError("UNAUTHORIZED", "Authentication required");
      response.status(200).json({ data: await this.authService.me(request.auth) });
    } catch (error) {
      next(error);
    }
  };
}

