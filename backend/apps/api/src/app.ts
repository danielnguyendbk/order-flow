import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";

import { createDatabasePool } from "./config/database.js";
import { getEnv } from "./config/env.js";
import { AppError } from "./core/errors.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { MemoryAuthSessionStore } from "./modules/auth/auth-session.store.js";
import { AuthService, type AuthServicePort } from "./modules/auth/auth.service.js";
import { AuthTokenService } from "./modules/auth/auth.tokens.js";
import { EmployeeRepository } from "./modules/employees/employee.repository.js";
import {
  EmployeeService,
  type EmployeeServicePort,
} from "./modules/employees/employee.service.js";
import { createApiRouter } from "./routes/index.js";

export interface CreateAppOptions {
  authService?: AuthServicePort;
  mountOperationalRoutes?: boolean;
  employeeService?: EmployeeServicePort;
}

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express();
  let authService = options.authService;
  let employeeService = options.employeeService;
  let dispose = async () => undefined;

  if (!authService) {
    const env = getEnv();
    const pool = createDatabasePool(env);
    const sessions = new MemoryAuthSessionStore(env.AUTH_SESSION_CACHE_MAX);
    authService = new AuthService(
      new AuthRepository(pool),
      sessions,
      new AuthTokenService(env),
      env,
    );
    employeeService = new EmployeeService(new EmployeeRepository(pool));
    dispose = async () => {
      sessions.clear();
      await pool.end();
    };
  }

  app.locals.dispose = dispose;
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "order-flow-api" });
  });
  app.use(
    "/api/v1",
    createApiRouter(
      authService,
      options.mountOperationalRoutes ?? options.authService === undefined,
      employeeService,
    ),
  );

  app.use((_request: Request, response: Response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(
    (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
      if (error instanceof ZodError) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        });
        return;
      }
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
      ) {
        const httpError = error as { statusCode: number; message?: string };
        response.status(httpError.statusCode).json({
          error: {
            code: httpError.statusCode === 404 ? "NOT_FOUND" : "ORDER_ERROR",
            message: httpError.message ?? "Request failed",
          },
        });
        return;
      }
      console.error(error);
      response.status(500).json({
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      });
    },
  );

  return app;
}
