import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class AuditService {
  public async listAuditLogs() {
    return prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

