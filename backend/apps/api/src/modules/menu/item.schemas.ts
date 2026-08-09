import { z } from "zod";

export const itemIdParamsSchema = z.object({ itemId: z.string().uuid() });

const filterFields = {
  categoryId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(150).optional(),
};

export const publicItemListQuerySchema = z.object(filterFields).transform((value) => ({
  ...value,
  page: 1,
  limit: 100,
  isAvailable: true as const,
  publicOnly: true as const,
}));

export const adminItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  ...filterFields,
  isAvailable: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  displayOrder: z.number().int().nonnegative().default(0),
});

export const updateItemSchema = createItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

