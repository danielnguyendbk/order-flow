import { NextFunction, Request, Response } from "express";
import { SepayService } from "./sepay.service";
import { validateSepayWebhook } from "./sepay.validation";

export class SepayController {
  constructor(private readonly sepayService: SepayService) {}

  public handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const v = validateSepayWebhook(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }

      const result = await this.sepayService.handleWebhook(req.body, req.headers);
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  };
}

