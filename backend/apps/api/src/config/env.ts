import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function findUp(filename: string, startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;
  while (true) {
    const candidate = join(directory, filename);
    if (existsSync(candidate)) return candidate;
    if (directory === root) return undefined;
    directory = dirname(directory);
  }
}

const envPath = process.env.ENV_FILE ?? findUp(".env.local", process.cwd());

if (envPath) {
  loadDotenv({ path: envPath, quiet: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),
  AUTH_SESSION_CACHE_MAX: z.coerce.number().int().positive().default(10_000),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(5 * 60),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
