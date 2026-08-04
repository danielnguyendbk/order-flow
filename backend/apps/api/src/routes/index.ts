import type { FastifyInstance } from "fastify";

import { authRoutes } from "../modules/auth/auth.routes.js";
import type { AuthServicePort } from "../modules/auth/auth.service.js";

export interface ApiRoutesOptions {
  authService: AuthServicePort;
}

export async function apiRoutes(
  app: FastifyInstance,
  options: ApiRoutesOptions,
): Promise<void> {
  await app.register(authRoutes, {
    prefix: "/api/v1",
    authService: options.authService,
  });
}

