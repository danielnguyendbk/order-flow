import type { NextFunction, Request, Response } from "express";

import type { EmployeeServicePort } from "./employee.service.js";
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  updateEmployeeSchema,
} from "./employee.schemas.js";

export class EmployeeController {
  constructor(private readonly service: EmployeeServicePort) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.list(employeeListQuerySchema.parse(req.query)));
    } catch (error) { next(error); }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = employeeIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.get(employeeId) });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ data: await this.service.create(createEmployeeSchema.parse(req.body)) });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = employeeIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.update(employeeId, updateEmployeeSchema.parse(req.body)) });
    } catch (error) { next(error); }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = employeeIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.activate(employeeId) });
    } catch (error) { next(error); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = employeeIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.deactivate(employeeId) });
    } catch (error) { next(error); }
  };
}

