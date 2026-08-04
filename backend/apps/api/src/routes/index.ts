import { Router } from "express";

import type { AuthServicePort } from "../modules/auth/auth.service.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createAdminItemRouter, createPublicItemRouter } from "../modules/menu/item.routes.js";
import type { ItemServicePort } from "../modules/menu/item.service.js";

export function createApiRouter(
  authService: AuthServicePort,
  mountOperationalRoutes = true,
  itemService?: ItemServicePort,
): Router {
  const router = Router();
  router.use(createAuthRouter(authService));
  if (itemService) {
    router.use("/menu/items", createPublicItemRouter(itemService));
    router.use("/admin/menu-items", createAdminItemRouter(authService, itemService));
  }

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
