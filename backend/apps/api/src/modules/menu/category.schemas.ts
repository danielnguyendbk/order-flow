import { z } from "zod";

export const categoryIdParamsSchema = z.object({ categoryId: z.string().uuid() });

export const categoryListQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  displayOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

