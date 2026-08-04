import { Request, Response, NextFunction } from "express";
import { BaristaService } from "./barista.service";

/**
 * Handles HTTP requests for barista-specific order views.
 *
 *   GET /api/v1/barista/queue   → getQueue
 *   GET /api/v1/barista/orders  → getBaristaOrders
 */
export class BaristaController {
  constructor(private readonly baristaService: BaristaService) {}

  // GET /api/v1/barista/queue
  // Returns all QUEUED (paid + not yet claimed) orders.
  public getQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queue = await this.baristaService.getQueue();
      res.status(200).json(queue);
    } catch (err) { next(err); }
  };

  // GET /api/v1/barista/orders
  // Query param: baristaId (required)
  // Returns orders currently PREPARING or READY for the given barista.
  public getBaristaOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const baristaId = req.query.baristaId as string;
      if (!baristaId) {
        res.status(400).json({ message: "baristaId query param is required" });
        return;
      }
      const orders = await this.baristaService.getBaristaOrders(baristaId);
      res.status(200).json(orders);
    } catch (err) { next(err); }
  };
}
