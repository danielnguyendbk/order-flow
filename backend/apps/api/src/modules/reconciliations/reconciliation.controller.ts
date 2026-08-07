import { NextFunction, Request, Response } from "express";
import { ReconciliationService } from "./reconciliation.service";
import { validateResolveReconciliation } from "./reconciliation.validation";

export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  public listTransactions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: await this.service.listTransactions() });
    } catch (err) {
      next(err);
    }
  };

  public getTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getTransaction(req.params.transactionId));
    } catch (err) {
      next(err);
    }
  };

  public listReconciliations = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: await this.service.listReconciliations() });
    } catch (err) {
      next(err);
    }
  };

  public getReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.service.getReconciliation(req.params.reconciliationId));
    } catch (err) {
      next(err);
    }
  };

  public resolveReconciliation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const v = validateResolveReconciliation(req.body);
      if (!v.isValid) {
        res.status(400).json({ message: "Validation failed", errors: v.errors });
        return;
      }

      res.status(200).json(
        await this.service.resolveReconciliation(req.params.reconciliationId, req.body)
      );
    } catch (err) {
      next(err);
    }
  };
}

