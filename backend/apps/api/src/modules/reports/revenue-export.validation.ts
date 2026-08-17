import { z } from "zod";
import { parseRevenueQuery, type RevenueQuery } from "./revenue.validation";

export const revenueExportFormatSchema = z.literal("xlsx");

const exportBodySchema = z.object({ format: revenueExportFormatSchema }).strict();

export type RevenueExportFormat = z.infer<typeof revenueExportFormatSchema>;
export type RevenueExportInput = RevenueQuery & { format: RevenueExportFormat };

export function parseRevenueExportInput(query: unknown, body: unknown): RevenueExportInput {
  const range = parseRevenueQuery(query);
  const result = exportBodySchema.safeParse(body);
  if (!result.success) {
    const error = Object.assign(new Error("Revenue export input is invalid"), {
      status: 400,
      details: result.error.flatten(),
    });
    throw error;
  }
  return { ...range, ...result.data };
}
