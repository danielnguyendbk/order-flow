import pg from "pg";

import type { AppEnv } from "./env.js";

const { Pool } = pg;

export function normalizeDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);

  // pg 8.22 treats sslmode=require as certificate verification unless libpq
  // compatibility is explicitly enabled. Supavisor presents a certificate
  // chain that otherwise fails with SELF_SIGNED_CERT_IN_CHAIN.
  if (
    url.searchParams.get("sslmode") === "require" &&
    !url.searchParams.has("uselibpqcompat")
  ) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

export function createDatabasePool(env: AppEnv) {
  return new Pool({
    connectionString: normalizeDatabaseUrl(env.DATABASE_URL),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
