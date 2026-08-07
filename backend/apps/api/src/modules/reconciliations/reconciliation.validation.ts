import { ResolutionAction } from "@prisma/client";
import { ValidationResult } from "../orders/order.validation";

export function validateResolveReconciliation(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body is required"] };
  }

  if (!data.resolvedByUserId || typeof data.resolvedByUserId !== "string") {
    errors.push("resolvedByUserId is required");
  }

  if (!data.resolutionAction || !Object.values(ResolutionAction).includes(data.resolutionAction)) {
    errors.push(`resolutionAction must be one of: ${Object.values(ResolutionAction).join(", ")}`);
  }

  if (!data.resolutionNote || typeof data.resolutionNote !== "string" || data.resolutionNote.trim() === "") {
    errors.push("resolutionNote is required");
  }

  return { isValid: errors.length === 0, errors };
}

