import { NextFunction, Request, Response } from "express";
import { AuditService } from "./audit.service";

export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  public listAuditLogs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: await this.auditService.listAuditLogs() });
    } catch (err) {
      next(err);
    }
  };
}

