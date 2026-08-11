import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaSingleton: PrismaClient | undefined;
}

function createPrismaInstance(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes("connection_limit=")) {
    const parsed = new URL(dbUrl);
    parsed.searchParams.set("connection_limit", "5");
    return new PrismaClient({
      datasources: {
        db: {
          url: parsed.toString(),
        },
      },
    });
  }
  return new PrismaClient();
}

export const prisma = globalThis.prismaSingleton ?? createPrismaInstance();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaSingleton = prisma;
}
