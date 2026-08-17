const { PrismaClient, UserRole, UserStatus } = require("@prisma/client");
const { hash } = require("bcryptjs");
const { applyMigrations } = require("./apply-migrations.cjs");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  await applyMigrations();
  const username = required("SEED_OWNER_USERNAME");
  const password = required("SEED_OWNER_PASSWORD");
  const fullName = process.env.SEED_OWNER_FULL_NAME?.trim() || "Store Owner";
  const rounds = Number(process.env.SEED_PASSWORD_ROUNDS || 12);

  if (password === "change-me" || password.startsWith("replace-with-")) {
    throw new Error("SEED_OWNER_PASSWORD must be changed from the example value");
  }
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    throw new Error("SEED_PASSWORD_ROUNDS must be an integer from 10 to 15");
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { role: true },
    });
    if (existing && existing.role !== UserRole.OWNER) {
      throw new Error(`Refusing to promote ${username} from ${existing.role} to OWNER`);
    }

    const passwordHash = await hash(password, rounds);
    const owner = await prisma.user.upsert({
      where: { username },
      create: {
        fullName,
        username,
        passwordHash,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
      update: { fullName, passwordHash, status: UserStatus.ACTIVE },
      select: { username: true, role: true, status: true },
    });
    console.info({ owner }, "Container database initialization completed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Container database initialization failed", error);
  process.exitCode = 1;
});
