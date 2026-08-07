import express, {
  type Application,
} from "express";

import { createDatabasePool } from "./config/database.js";
import { getEnv } from "./config/env.js";
import { errorHandler, notFound, requestId } from "./middleware/index.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { MemoryAuthSessionStore } from "./modules/auth/auth-session.store.js";
import { AuthService, type AuthServicePort } from "./modules/auth/auth.service.js";
import { AuthTokenService } from "./modules/auth/auth.tokens.js";
import {
  createTelegramSessionRouter,
  type TelegramSessionRouterOptions,
} from "./modules/auth/telegram-session.routes";
import {
  createTelegramBaristaRouter,
  type TelegramBaristaRouterOptions,
} from "./modules/barista/telegram-barista.routes";
import { EmployeeRepository } from "./modules/employees/employee.repository.js";
import {
  EmployeeService,
  type EmployeeServicePort,
} from "./modules/employees/employee.service.js";
import {
  createTelegramOrderRouter,
  type TelegramOrderRouterOptions,
} from "./modules/orders/telegram-order.routes";
import { createApiRouter } from "./routes/index.js";

export interface CreateAppOptions {
  authService?: AuthServicePort;
  mountOperationalRoutes?: boolean;
  employeeService?: EmployeeServicePort;
  telegramSession?: TelegramSessionRouterOptions;
  telegramOrders?: Omit<TelegramOrderRouterOptions, "internalSecret">;
  telegramBarista?: Omit<TelegramBaristaRouterOptions, "internalSecret">;
}

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express();
  let authService = options.authService;
  let employeeService = options.employeeService;
  let dispose = async () => undefined;
  const botOnly =
    !authService &&
    Boolean(options.telegramSession || options.telegramOrders || options.telegramBarista);

  if (!authService && !botOnly) {
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
  app.use(requestId);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "order-flow-api" });
  });

  const apiV1 = express.Router();
  const botInternalSecret =
    options.telegramSession?.internalSecret ?? process.env.BOT_INTERNAL_SECRET ?? "";

  if (botInternalSecret) {
    const telegramBotRouter = express.Router();
    telegramBotRouter.use(
      createTelegramOrderRouter({
        internalSecret: botInternalSecret,
        ...options.telegramOrders,
      }),
    );
    telegramBotRouter.use(
      createTelegramBaristaRouter({
        internalSecret: botInternalSecret,
        ...options.telegramBarista,
      }),
    );
    telegramBotRouter.use(
      "/telegram",
      createTelegramSessionRouter(
        options.telegramSession ?? { internalSecret: botInternalSecret },
      ),
    );

    // Bot and browser APIs share several paths. Only internal Bot requests
    // enter the Bot-owned routers; all others continue to the public API.
    apiV1.use((request, response, next) => {
      if (!request.header("x-bot-internal-secret")) {
        next();
        return;
      }
      telegramBotRouter(request, response, next);
    });
  }

  if (authService) {
    apiV1.use(
      createApiRouter(
        authService,
        options.mountOperationalRoutes ?? options.authService === undefined,
        employeeService,
      ),
    );
  }
  app.use("/api/v1", apiV1);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
