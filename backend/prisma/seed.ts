import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

import { getSeedConfig } from "../apps/api/src/config/seed.config.js";
import { seedBe004IntegrationFixtures } from "./seeds/be004-integration-fixtures.seed";
import { seedThai001CashPayment } from "./seeds/thai001-cash-payment.seed";
import { seedThai002QrPayment } from "./seeds/thai002-qr-payment.seed";
import { seedThai003SepayWebhook } from "./seeds/thai003-sepay-webhook.seed";
import { seedThai004Reconciliation } from "./seeds/thai004-reconciliation.seed";
import { seedThai005Refund } from "./seeds/thai005-refund.seed";
import { seedThai006Revenue } from "./seeds/thai006-revenue.seed";
import { seedSmallShopMenu } from "./seeds/small-shop-menu.seed";

const prisma = new PrismaClient();

async function seedOwner(): Promise<void> {
  const config = getSeedConfig();
  const existingUser = await prisma.user.findUnique({
    where: { username: config.username },
    select: { id: true, role: true },
  });

  if (existingUser && existingUser.role !== UserRole.OWNER) {
    throw new Error(
      `Refusing to promote existing user ${config.username} from ${existingUser.role} to OWNER`,
    );
  }

  const passwordHash = await hash(config.password, config.passwordRounds);
  const owner = await prisma.user.upsert({
    where: { username: config.username },
    create: {
      fullName: config.fullName,
      username: config.username,
      passwordHash,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
    update: {
      fullName: config.fullName,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      status: true,
    },
  });

  console.info({ owner }, "Initial OWNER seed completed");
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? "owner";

  if (target === "owner") {
    await seedOwner();
    return;
  }

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

  if (target === "be004") {
    await seedBe004IntegrationFixtures(prisma);
    return;
  }

  if (target === "menu") {
    await seedSmallShopMenu(prisma);
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

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
