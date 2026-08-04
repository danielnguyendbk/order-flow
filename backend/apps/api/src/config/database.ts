import pg from "pg";

import type { AppEnv } from "./env.js";

const { Pool } = pg;

export function createDatabasePool(env: AppEnv) {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
