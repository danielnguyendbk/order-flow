import type { NextFunction, Request, Response } from "express";

import {
  adminItemListQuerySchema,
  createItemSchema,
  itemIdParamsSchema,
  publicItemListQuerySchema,
  updateItemSchema,
} from "./item.schemas.js";
import type { ItemServicePort } from "./item.service.js";

export class ItemController {
  constructor(private readonly service: ItemServicePort) {}

  listPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.list(publicItemListQuerySchema.parse(req.query));
      res.json({ data: result.data });
    } catch (error) { next(error); }
  };
  listAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await this.service.list(adminItemListQuerySchema.parse(req.query))); } catch (error) { next(error); }
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = itemIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.get(itemId) });
    } catch (error) { next(error); }
  };
  create = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ data: await this.service.create(createItemSchema.parse(req.body)) }); } catch (error) { next(error); }
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = itemIdParamsSchema.parse(req.params);
      res.json({ data: await this.service.update(itemId, updateItemSchema.parse(req.body)) });
    } catch (error) { next(error); }
  };
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = itemIdParamsSchema.parse(req.params);
      await this.service.delete(itemId);
      res.status(204).send();
    } catch (error) { next(error); }
  };
}

