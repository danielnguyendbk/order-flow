import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { requireAdminAccess } from "./auth.middleware.js";
import { rateLimit } from "../../middleware/index.js";
import type { AuthServicePort } from "./auth.service.js";
import type { AuthSessionStorePort } from "./auth-session.store.js";

export function createAuthRouter(authService: AuthServicePort): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const adminAuth = requireAdminAccess(authService);

  const authRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 });
  router.post("/telegram/session", authRateLimit, controller.telegramSession);
  router.post("/admin/auth/login", authRateLimit, controller.adminLogin);
  router.post("/admin/auth/refresh", authRateLimit, controller.refresh);
  router.post("/admin/auth/logout", adminAuth, controller.logout);
  router.get("/admin/auth/me", adminAuth, controller.me);

  // DEBUG ONLY — xem session cache đang active, chỉ bật ở development
  if (process.env.NODE_ENV !== "production") {
    router.get("/admin/auth/debug/sessions", async (_req, res, next) => {
      const store = (authService as any)["sessions"] as AuthSessionStorePort | undefined;
      if (!store || typeof store.list !== "function") {
        res.status(501).json({ error: "Session store does not support listing" });
        return;
      }
      try {
        const sessions = (await store.list()).map(({ refreshTokenHash: _, ...safe }) => ({
          ...safe,
          expiresAt: safe.expiresAt.toISOString(),
          expiresInSeconds: Math.round((safe.expiresAt.getTime() - Date.now()) / 1000),
        }));
        res.json({ count: sessions.length, sessions });
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
