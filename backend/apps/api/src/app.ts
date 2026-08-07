import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { createDatabasePool } from "./config/database.js";
import { getEnv } from "./config/env.js";
import { AppError } from "./core/errors.js";
import { errorHandler, notFound, requestId } from "./middleware/index.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { MemoryAuthSessionStore } from "./modules/auth/auth-session.store.js";
import { AuthService, type AuthServicePort } from "./modules/auth/auth.service.js";
import { AuthTokenService } from "./modules/auth/auth.tokens.js";
import { EmployeeRepository } from "./modules/employees/employee.repository.js";
import {
  EmployeeService,
  type EmployeeServicePort,
} from "./modules/employees/employee.service.js";
import { CategoryRepository } from "./modules/menu/category.repository.js";
import {
  CategoryService,
  type CategoryServicePort,
} from "./modules/menu/category.service.js";
import { createApiRouter } from "./routes/index.js";

export interface CreateAppOptions {
  authService?: AuthServicePort;
  mountOperationalRoutes?: boolean;
  employeeService?: EmployeeServicePort;
  categoryService?: CategoryServicePort;
}

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express();
  let authService = options.authService;
  let employeeService = options.employeeService;
  let categoryService = options.categoryService;
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
    categoryService = new CategoryService(new CategoryRepository(pool));
    dispose = async () => {
      sessions.clear();
      await pool.end();
    };
  }

  app.locals.dispose = dispose;
  app.use(requestId);
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
      categoryService,
    ),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
