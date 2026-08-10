import createHttpError from "http-errors";
import {
  AuditEntityType,
  Prisma,
  PrismaClient,
  ResolutionAction,
  TransactionMatchStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

export interface ResolveReconciliationInput {
  resolvedByUserId: string;
  resolutionAction: ResolutionAction;
  resolutionNote: string;
}

export class ReconciliationService {
  constructor(private readonly db: PrismaClient = prisma) {}

  public async listTransactions() {
    return this.db.sepayTransaction.findMany({
      include: {
        payment: { include: { order: true } },
        resolvedBy: true,
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  public async getTransaction(transactionId: string) {
    const transaction = await this.db.sepayTransaction.findUnique({
      where: { id: transactionId },
      include: {
        payment: { include: { order: true } },
        resolvedBy: true,
      },
    });

    if (!transaction) throw createHttpError(404, `Transaction ${transactionId} not found`);
    return transaction;
  }

  public async listReconciliations() {
    return this.db.sepayTransaction.findMany({
      where: {
        OR: [
          { matchStatus: TransactionMatchStatus.UNMATCHED },
          { matchStatus: TransactionMatchStatus.WRONG_CODE },
        ],
      },
      include: {
        payment: { include: { order: true } },
        resolvedBy: true,
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  public async getReconciliation(reconciliationId: string) {
    const reconciliation = await this.db.sepayTransaction.findUnique({
      where: { id: reconciliationId },
      include: {
        payment: { include: { order: true } },
        resolvedBy: true,
      },
    });

    if (!reconciliation) {
      throw createHttpError(404, `Reconciliation ${reconciliationId} not found`);
    }

    return reconciliation;
  }

  public async resolveReconciliation(
    reconciliationId: string,
    input: ResolveReconciliationInput
  ) {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const [reconciliation, user] = await Promise.all([
        tx.sepayTransaction.findUnique({ where: { id: reconciliationId } }),
        tx.user.findUnique({ where: { id: input.resolvedByUserId } }),
      ]);

      if (!reconciliation) {
        throw createHttpError(404, `Reconciliation ${reconciliationId} not found`);
      }
      if (!user) {
        throw createHttpError(404, `User ${input.resolvedByUserId} not found`);
      }
      if (user.role !== "OWNER") {
        throw createHttpError(403, "Only owner can resolve reconciliation records");
      }

      const resolved = await tx.sepayTransaction.update({
        where: { id: reconciliationId },
        data: {
          matchStatus: TransactionMatchStatus.REVIEWED,
          resolutionAction: input.resolutionAction,
          resolutionNote: input.resolutionNote.trim(),
          resolvedByUserId: input.resolvedByUserId,
          resolvedAt: new Date(),
        },
        include: {
          payment: { include: { order: true } },
          resolvedBy: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.resolvedByUserId,
          action: "RECONCILIATION_RESOLVED",
          entityType: AuditEntityType.SEPAY_TRANSACTION,
          entityId: reconciliationId,
          details: {
            previousMatchStatus: reconciliation.matchStatus,
            newMatchStatus: TransactionMatchStatus.REVIEWED,
            previousResolutionAction: reconciliation.resolutionAction,
            resolutionAction: input.resolutionAction,
            resolutionNote: input.resolutionNote.trim(),
            paymentId: reconciliation.paymentId,
            differenceAmount: reconciliation.differenceAmount?.toString() ?? null,
          },
        },
      });

      return resolved;
    });
  }
}
