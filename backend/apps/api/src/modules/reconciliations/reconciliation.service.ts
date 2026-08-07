import createHttpError from "http-errors";
import { PrismaClient, ResolutionAction, TransactionMatchStatus } from "@prisma/client";

const prisma = new PrismaClient();

export interface ResolveReconciliationInput {
  resolvedByUserId: string;
  resolutionAction: ResolutionAction;
  resolutionNote: string;
}

export class ReconciliationService {
  public async listTransactions() {
    return prisma.sepayTransaction.findMany({
      include: {
        payment: { include: { order: true } },
        resolvedBy: true,
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  public async getTransaction(transactionId: string) {
    const transaction = await prisma.sepayTransaction.findUnique({
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
    return prisma.sepayTransaction.findMany({
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
    const reconciliation = await prisma.sepayTransaction.findUnique({
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
    const [reconciliation, user] = await Promise.all([
      prisma.sepayTransaction.findUnique({ where: { id: reconciliationId } }),
      prisma.user.findUnique({ where: { id: input.resolvedByUserId } }),
    ]);

    if (!reconciliation) {
      throw createHttpError(404, `Reconciliation ${reconciliationId} not found`);
    }
    if (!user) {
      throw createHttpError(404, `User ${input.resolvedByUserId} not found`);
    }

    return prisma.sepayTransaction.update({
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
  }
}

