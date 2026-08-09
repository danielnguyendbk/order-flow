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
if (envPath) loadDotenv({ path: envPath, quiet: true });

const seedConfigSchema = z.object({
  SEED_OWNER_FULL_NAME: z.string().trim().min(1).default("Store Owner"),
  SEED_OWNER_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .default("owner"),
  SEED_OWNER_PASSWORD: z
    .string()
    .min(12, "SEED_OWNER_PASSWORD must contain at least 12 characters"),
  SEED_PASSWORD_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
});

export interface SeedConfig {
  fullName: string;
  username: string;
  password: string;
  passwordRounds: number;
}

export function getSeedConfig(): SeedConfig {
  const env = seedConfigSchema.parse(process.env);
  return {
    fullName: env.SEED_OWNER_FULL_NAME,
    username: env.SEED_OWNER_USERNAME,
    password: env.SEED_OWNER_PASSWORD,
    passwordRounds: env.SEED_PASSWORD_ROUNDS,
  };
}
