import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDatabaseUrl } from "../src/config/database.js";

test("database URL enables libpq-compatible sslmode=require", () => {
  const normalized = new URL(
    normalizeDatabaseUrl(
      "postgresql://user:password@example.com:6543/postgres?pgbouncer=true&sslmode=require",
    ),
  );

  assert.equal(normalized.searchParams.get("sslmode"), "require");
  assert.equal(normalized.searchParams.get("uselibpqcompat"), "true");
  assert.equal(normalized.searchParams.get("pgbouncer"), "true");
});

test("database URL preserves an explicit SSL compatibility choice", () => {
  const normalized = new URL(
    normalizeDatabaseUrl(
      "postgresql://user:password@example.com/postgres?sslmode=verify-full",
    ),
  );

  assert.equal(normalized.searchParams.get("sslmode"), "verify-full");
  assert.equal(normalized.searchParams.has("uselibpqcompat"), false);
});
