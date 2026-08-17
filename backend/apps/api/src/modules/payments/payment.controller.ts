import { NextFunction, Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { validateConfirmCash, validateInitQrPayment } from "./payment.validation";

type OrderParams = { orderId: string };

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  public listOrderPayments = async (
    req: Request<OrderParams>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payments = await this.paymentService.listOrderPayments(req.params.orderId);
      res.status(200).json({ data: payments });
    } catch (err) {
      next(err);
    }
  };

  public confirmCash = async (
    req: Request<OrderParams>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const v = validateConfirmCash(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }
      if (!req.auth) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      const payment = await this.paymentService.confirmCash(req.params.orderId, {
        amount: req.body.amount,
        actorUserId: req.auth.userId,
      });
      res.status(200).json(payment);
    } catch (err) {
      next(err);
    }
  };

  public initQrPayment = async (
    req: Request<OrderParams>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const v = validateInitQrPayment(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }
      if (!req.auth) {
        res.status(401).json({ message: "Authenticated user is required" });
        return;
      }

      const result = await this.paymentService.initQrPayment(req.params.orderId, {
        actorUserId: req.auth.userId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
