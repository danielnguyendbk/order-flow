import { NextFunction, Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { validateConfirmCash, validateInitQrPayment } from "./payment.validation";

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  public listOrderPayments = async (
    req: Request,
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
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const v = validateConfirmCash(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }

      const payment = await this.paymentService.confirmCash(req.params.orderId, req.body);
      res.status(200).json(payment);
    } catch (err) {
      next(err);
    }
  };

  public initQrPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const v = validateInitQrPayment(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }

      const result = await this.paymentService.initQrPayment(req.params.orderId, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
