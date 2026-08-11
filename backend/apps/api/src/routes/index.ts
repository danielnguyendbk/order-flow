import { Router } from "express";

import type { AuthServicePort } from "../modules/auth/auth.service.js";
import { requireAdminAccess } from "../modules/auth/auth.middleware.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createEmployeeRouter } from "../modules/employees/employee.routes.js";
import type { EmployeeServicePort } from "../modules/employees/employee.service.js";
import {
  createAdminCategoryRouter,
  createPublicCategoryRouter,
} from "../modules/menu/category.routes.js";
import type { CategoryServicePort } from "../modules/menu/category.service.js";
import { createAdminItemRouter, createPublicItemRouter } from "../modules/menu/item.routes.js";
import type { ItemServicePort } from "../modules/menu/item.service.js";

export interface OperationalRouterFactories {
  createOrderRouter?: () => Router;
  createBaristaRouter?: () => Router;
  createAdminRouter?: (authService: AuthServicePort) => Router;
}

export function createApiRouter(
  authService: AuthServicePort,
  mountOperationalRoutes = true,
  employeeService?: EmployeeServicePort,
  categoryService?: CategoryServicePort,
  itemService?: ItemServicePort,
  operationalRouters: OperationalRouterFactories = {},
): Router {
  const router = Router();
  router.use(createAuthRouter(authService));

  if (employeeService) {
    router.use("/admin/employees", createEmployeeRouter(authService, employeeService));
  }

  if (categoryService) {
    router.use("/menu/categories", createPublicCategoryRouter(categoryService));
    router.use(
      "/admin/menu-categories",
      createAdminCategoryRouter(authService, categoryService),
    );
  }

  if (itemService) {
    router.use("/menu/items", createPublicItemRouter(itemService));
    router.use("/admin/menu-items", createAdminItemRouter(authService, itemService));
  }

  // Loaded lazily so auth and isolated module tests do not initialize Prisma.
  // Injecting factory overrides (operationalRouters) lets tests exercise the
  // auth gate without touching Prisma-backed modules.
  if (mountOperationalRoutes) {
    const {
      createOrderRouter = () => require("../modules/orders/order.routes.js").createOrderRouter(),
      createBaristaRouter = () => require("../modules/barista/barista.routes.js").createBaristaRouter(),
      createAdminRouter = (auth: AuthServicePort) =>
        require("../modules/admin/admin.routes.js").createAdminRouter(auth),
    } = operationalRouters;

    // Order/Payment mutating routes are only consumed by authenticated web clients
    // (admin FE) — the Telegram Bot reaches /orders via the internal-secret-gated
    // telegram router, so requiring an admin token here does not affect the Bot.
    router.use("/orders", requireAdminAccess(authService), createOrderRouter());
    router.use("/barista", requireAdminAccess(authService), createBaristaRouter());
    router.use("/admin", createAdminRouter(authService));
  }

  return router;
}
