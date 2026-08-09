import { Router } from "express";

import type { AuthServicePort } from "../auth/auth.service.js";
import { requireAdminAuth } from "../auth/auth.middleware.js";
import { ItemController } from "./item.controller.js";
import type { ItemServicePort } from "./item.service.js";

export function createPublicItemRouter(service: ItemServicePort): Router {
  const router = Router();
  const controller = new ItemController(service);
  router.get("/", controller.listPublic);
  return router;
}

export function createAdminItemRouter(
  authService: AuthServicePort,
  itemService: ItemServicePort,
): Router {
  const router = Router();
  const controller = new ItemController(itemService);
  router.use(requireAdminAuth(authService));
  router.get("/", controller.listAdmin);
  router.get("/:itemId", controller.get);
  router.post("/", controller.create);
  router.patch("/:itemId", controller.update);
  router.delete("/:itemId", controller.delete);
  return router;
}

