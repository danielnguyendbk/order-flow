import { prisma } from "../../db";

export class AuditService {
  public async listAuditLogs() {
    return prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

