import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { requireAdminAuth } from "./auth.middleware.js";
import type { AuthServicePort } from "./auth.service.js";

export function createAuthRouter(authService: AuthServicePort): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const adminAuth = requireAdminAuth(authService);

  router.post("/telegram/session", controller.telegramSession);
  router.post("/admin/auth/login", controller.adminLogin);
  router.post("/admin/auth/refresh", controller.refresh);
  router.post("/admin/auth/logout", adminAuth, controller.logout);
  router.get("/admin/auth/me", adminAuth, controller.me);
  return router;
}
