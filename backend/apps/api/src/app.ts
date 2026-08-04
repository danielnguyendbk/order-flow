import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { createDatabasePool } from "./config/database.js";
import { getEnv } from "./config/env.js";
import { AppError } from "./core/errors.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { MemoryAuthSessionStore } from "./modules/auth/auth-session.store.js";
import { AuthService, type AuthServicePort } from "./modules/auth/auth.service.js";
import { AuthTokenService } from "./modules/auth/auth.tokens.js";
import { apiRoutes } from "./routes/index.js";

export interface CreateAppOptions {
  authService?: AuthServicePort;
  logger?: boolean;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  let authService = options.authService;

  if (!authService) {
    const env = getEnv();
    const pool = createDatabasePool(env);
    const repository = new AuthRepository(pool);
    const sessions = new MemoryAuthSessionStore(env.AUTH_SESSION_CACHE_MAX);
    authService = new AuthService(
      repository,
      sessions,
      new AuthTokenService(env),
      env,
    );
    app.addHook("onClose", async () => {
      sessions.clear();
      await pool.end();
    });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
    });
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(apiRoutes, { authService });
  return app;
}
