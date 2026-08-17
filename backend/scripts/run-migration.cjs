/* Runs a SQL migration file against the configured database (idempotent). */
const fs = require("fs");
const path = require("path");

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/run-migration.cjs <path.sql>");
    process.exit(1);
  }

  // Resolve the effective DATABASE_URL the same way Prisma does (loads .env.local).
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRawUnsafe("SELECT current_database() AS db, current_user AS usr");
  console.log(`Connected to ${rows[0].db} as ${rows[0].usr}`);

  const pg = require(path.resolve(__dirname, "../apps/api/node_modules/pg"));
  const { Pool } = pg;
  const rawUrl = new URL(process.env.DATABASE_URL);
  if (rawUrl.searchParams.get("sslmode") === "require" && !rawUrl.searchParams.has("uselibpqcompat")) {
    rawUrl.searchParams.set("uselibpqcompat", "true");
  }
  const pool = new Pool({ connectionString: rawUrl.toString() });

  const sql = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const client = await pool.connect();
  try {
    // pg executes the whole script as one simple-query batch.
    await client.query(sql);
    console.log(`Done: migration applied -> ${file}`);
  } finally {
    client.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
