/* Apply tracked forward-only SQL migrations exactly once per database. */
const fs = require("node:fs");
const path = require("node:path");

function migrationDirectories(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function applyMigrations() {
  const { Pool } = require(path.resolve(__dirname, "../apps/api/node_modules/pg"));
  const migrationsRoot = path.resolve(__dirname, "../prisma/migrations");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (databaseUrl.searchParams.get("sslmode") === "require" && !databaseUrl.searchParams.has("uselibpqcompat")) {
    databaseUrl.searchParams.set("uselibpqcompat", "true");
  }
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  const client = await pool.connect();

  try {
    await client.query("select pg_advisory_lock(843271949)");
    await client.query(`
      create table if not exists public.schema_migrations (
        id varchar(255) primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const id of migrationDirectories(migrationsRoot)) {
      const migrationFile = path.join(migrationsRoot, id, "migration.sql");
      if (!fs.existsSync(migrationFile)) continue;

      const applied = await client.query(
        "select 1 from public.schema_migrations where id = $1",
        [id],
      );
      if (applied.rowCount) continue;

      const sql = fs.readFileSync(migrationFile, "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (id) values ($1)",
          [id],
        );
        await client.query("commit");
        console.log(`Applied migration ${id}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    try { await client.query("select pg_advisory_unlock(843271949)"); } catch {}
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  applyMigrations().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { applyMigrations };
