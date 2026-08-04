import type { FastifyInstance } from "fastify";

import { AuthController } from "./auth.controller.js";
import { requireAdminAuth } from "./auth.middleware.js";
import type { AuthServicePort } from "./auth.service.js";

export interface AuthRoutesOptions {
  authService: AuthServicePort;
}

export async function authRoutes(
  app: FastifyInstance,
  options: AuthRoutesOptions,
): Promise<void> {
  const controller = new AuthController(options.authService);
  const adminAuth = requireAdminAuth(options.authService);

  app.post("/telegram/session", controller.telegramSession);
  app.post("/admin/auth/login", controller.adminLogin);
  app.post("/admin/auth/refresh", controller.refresh);
  app.post(
    "/admin/auth/logout",
    { preHandler: adminAuth },
    controller.logout,
  );
  app.get("/admin/auth/me", { preHandler: adminAuth }, controller.me);
}

