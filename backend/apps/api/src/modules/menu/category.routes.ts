import { Router } from "express";

import type { AuthServicePort } from "../auth/auth.service.js";
import { requireAdminAuth } from "../auth/auth.middleware.js";
import { CategoryController } from "./category.controller.js";
import type { CategoryServicePort } from "./category.service.js";

export function createPublicCategoryRouter(service: CategoryServicePort): Router {
  const router = Router();
  const controller = new CategoryController(service);
  router.get("/", controller.listPublic);
  return router;
}

export function createAdminCategoryRouter(
  authService: AuthServicePort,
  categoryService: CategoryServicePort,
): Router {
  const router = Router();
  const controller = new CategoryController(categoryService);
  router.use(requireAdminAuth(authService));
  router.get("/", controller.listAdmin);
  router.post("/", controller.create);
  router.patch("/:categoryId", controller.update);
  router.delete("/:categoryId", controller.delete);
  return router;
}

