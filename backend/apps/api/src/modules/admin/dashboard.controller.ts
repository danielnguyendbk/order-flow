import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import type { DashboardServicePort } from "./dashboard.service.js";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

export class DashboardController {
  constructor(private readonly dashboardService: DashboardServicePort) {}

  public getDashboard = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const days = parseDays(request.query.days);
      const dashboard = await this.dashboardService.getDashboard({ days });
      response.status(200).json({ data: dashboard });
    } catch (error) {
      next(error);
    }
  };
}

export function parseDays(value: unknown): number {
  if (value === undefined) return DEFAULT_DAYS;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "days must be an integer from 1 to 90",
    );
  }

  const days = Number(value);
  if (days < 1 || days > MAX_DAYS) {
    throw new AppError(
      "VALIDATION_ERROR",
      "days must be an integer from 1 to 90",
    );
  }
  return days;
}
