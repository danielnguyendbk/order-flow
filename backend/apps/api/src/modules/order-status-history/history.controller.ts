import { Request, Response, NextFunction } from "express";
import { HistoryService } from "./history.service";

/**
 * Controller for retrieving order status history logs.
 */
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  // GET /api/v1/orders/:orderId/history
  /**
   * Returns the full status history log for a given order.
   */
  public getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await this.historyService.getOrderHistory(req.params.orderId);
      res.status(200).json(logs);
    } catch (err) {
      next(err);
    }
  };
}
