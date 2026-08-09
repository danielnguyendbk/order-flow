import { Router } from "express";

import type { AuthServicePort } from "../auth/auth.service.js";
import { requireAdminAuth } from "../auth/auth.middleware.js";
import { EmployeeController } from "./employee.controller.js";
import type { EmployeeServicePort } from "./employee.service.js";

export function createEmployeeRouter(
  authService: AuthServicePort,
  employeeService: EmployeeServicePort,
): Router {
  const router = Router();
  const controller = new EmployeeController(employeeService);
  router.use(requireAdminAuth(authService));
  router.get("/", controller.list);
  router.get("/:employeeId", controller.get);
  router.post("/", controller.create);
  router.patch("/:employeeId", controller.update);
  router.post("/:employeeId/activate", controller.activate);
  router.post("/:employeeId/deactivate", controller.deactivate);
  return router;
}
