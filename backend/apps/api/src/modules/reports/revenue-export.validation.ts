import { z } from "zod";
import { parseRevenueQuery, type RevenueQuery } from "./revenue.validation";

export const revenueExportFormatSchema = z.enum([
  "xlsx",
  "tax-revenue",
  "tax-revenue-expense",
]);

const moneySchema = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const percentSchema = z.coerce.number().min(0).max(100);

const taxDeclarationSchema = z.object({
  taxpayerName: z.string().trim().min(1).max(255),
  taxCode: z.string().trim().min(3).max(30),
  activityName: z.string().trim().min(1).max(255).default("Dịch vụ ăn uống"),
  taxRatePercent: percentSchema,
  deductibleExpenses: moneySchema.default(0),
  adjustmentsIncrease: moneySchema.default(0),
  adjustmentsDecrease: moneySchema.default(0),
  exemptIncome: moneySchema.default(0),
  carriedLoss: moneySchema.default(0),
  scienceFund: moneySchema.default(0),
  taxRelief: moneySchema.default(0),
  priorOverpayment: moneySchema.default(0),
  provisionalTaxPaid: moneySchema.default(0),
});

const exportBodySchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal("xlsx") }),
  taxDeclarationSchema.extend({ format: z.literal("tax-revenue") }),
  taxDeclarationSchema.extend({ format: z.literal("tax-revenue-expense") }),
]);

export type RevenueExportFormat = z.infer<typeof revenueExportFormatSchema>;
export type TaxDeclarationInput = z.infer<typeof taxDeclarationSchema>;

export type RevenueExportInput = RevenueQuery &
  (
    | { format: "xlsx" }
    | ({ format: "tax-revenue" | "tax-revenue-expense" } & TaxDeclarationInput)
  );

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
  const parsed = result.data;
  return { ...range, ...parsed } as RevenueExportInput;
}
