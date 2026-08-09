import type { NextFunction, Request, Response } from "express";

import {
  categoryIdParamsSchema,
  categoryListQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.schemas.js";
import type { CategoryServicePort } from "./category.service.js";

export class CategoryController {
  constructor(private readonly service: CategoryServicePort) {}

  listPublic = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await this.service.listPublic() }); } catch (error) { next(error); }
  };
  listAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await this.service.listAdmin(categoryListQuerySchema.parse(req.query)) }); } catch (error) { next(error); }
  };
  create = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ data: await this.service.create(createCategorySchema.parse(req.body)) }); } catch (error) { next(error); }
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = categoryIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.update(categoryId, updateCategorySchema.parse(req.body)) });
    } catch (error) { next(error); }
  };
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = categoryIdParamsSchema.parse(req.params);
      await this.service.delete(categoryId);
      res.status(204).send();
    } catch (error) { next(error); }
  };
}

