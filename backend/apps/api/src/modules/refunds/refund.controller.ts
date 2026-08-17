import { NextFunction, Request, Response } from "express";
import { RefundService } from "./refund.service";
import { validateRefundOrder } from "./refund.validation";

type RefundParams = { orderId: string };

export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  public refundOrder = async (
    req: Request<RefundParams>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const v = validateRefundOrder(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }
      if (!req.auth) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      res.status(200).json(
        await this.refundService.refundOrder(req.params.orderId, {
          reason: req.body.reason,
          amount: req.body.amount,
          actorUserId: req.auth.userId,
        })
      );
    } catch (err) {
      next(err);
    }
  };
}
