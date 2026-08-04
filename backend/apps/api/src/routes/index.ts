import { Router } from "express";

import type { AuthServicePort } from "../modules/auth/auth.service.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";

export function createApiRouter(
  authService: AuthServicePort,
  mountOperationalRoutes = true,
): Router {
  const router = Router();
  router.use(createAuthRouter(authService));

  // Loaded lazily so auth and isolated module tests do not initialize Prisma.
  if (mountOperationalRoutes) {
    const { createOrderRouter } = require("../modules/orders/order.routes");
    const { createBaristaRouter } = require("../modules/barista/barista.routes");
    const { createAdminRouter } = require("../modules/admin/admin.routes");
    router.use("/orders", createOrderRouter());
    router.use("/barista", createBaristaRouter());
    router.use("/admin", createAdminRouter());
  }
  return router;
}
