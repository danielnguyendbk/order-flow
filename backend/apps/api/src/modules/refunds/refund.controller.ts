import { NextFunction, Request, Response } from "express";
import { RefundService } from "./refund.service";
import { validateRefundOrder } from "./refund.validation";

export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  public refundOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const v = validateRefundOrder(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }

      res.status(200).json(
        await this.refundService.refundOrder(req.params.orderId, req.body)
      );
    } catch (err) {
      next(err);
    }
  };
}

