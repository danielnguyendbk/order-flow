import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

import { getSeedConfig } from "../apps/api/src/config/seed.config.js";

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

seedOwner()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
