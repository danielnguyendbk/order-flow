import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedThai001CashPayment } from "./seeds/thai001-cash-payment.seed";
import { seedThai002QrPayment } from "./seeds/thai002-qr-payment.seed";
import { seedThai003SepayWebhook } from "./seeds/thai003-sepay-webhook.seed";
import { seedThai004Reconciliation } from "./seeds/thai004-reconciliation.seed";
import { seedThai005Refund } from "./seeds/thai005-refund.seed";
import { seedThai006Revenue } from "./seeds/thai006-revenue.seed";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), "..", ".env"));
loadEnvFile(resolve(process.cwd(), "..", ".env.local"));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Add your Supabase PostgreSQL connection string to backend/.env.local or the repository .env.local before running seed."
  );
}

process.env.DIRECT_URL ??= process.env.DATABASE_URL;

const prisma = new PrismaClient();

async function main() {
  const target = process.argv[2] ?? "thai001";

  if (target === "thai001") {
    await seedThai001CashPayment(prisma);
    return;
  }

  if (target === "thai002") {
    await seedThai002QrPayment(prisma);
    return;
  }

  if (target === "thai003") {
    await seedThai003SepayWebhook(prisma);
    return;
  }

  if (target === "thai004") {
    await seedThai004Reconciliation(prisma);
    return;
  }

  if (target === "thai005") {
    await seedThai005Refund(prisma);
    return;
  }

  if (target === "thai006") {
    await seedThai006Revenue(prisma);
    return;
  }

  if (target === "thai") {
    await seedThai001CashPayment(prisma);
    await seedThai002QrPayment(prisma);
    await seedThai003SepayWebhook(prisma);
    await seedThai004Reconciliation(prisma);
    await seedThai005Refund(prisma);
    await seedThai006Revenue(prisma);
    return;
  }

  throw new Error(`Unknown seed target: ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
