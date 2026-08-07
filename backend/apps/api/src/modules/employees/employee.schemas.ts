import { z } from "zod";

const telegramId = z.string().regex(/^[1-9]\d*$/);
const nullableUsername = z.string().trim().min(1).max(100).nullable();

export const employeeIdParamsSchema = z.object({
  employeeId: z.string().uuid(),
});

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(150).optional(),
  role: z.enum(["SERVICE_STAFF", "BARISTA"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  telegramUserId: telegramId,
  telegramChatId: z.string().regex(/^-?\d+$/).nullable().optional(),
  username: nullableUsername.optional(),
  role: z.enum(["SERVICE_STAFF", "BARISTA"]),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

