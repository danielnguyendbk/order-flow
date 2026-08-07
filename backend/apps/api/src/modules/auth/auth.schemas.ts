import { z } from "zod";

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const telegramSessionSchema = z.object({
  initData: z.string().min(1).max(10_000),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type TelegramSessionInput = z.infer<typeof telegramSessionSchema>;

