import { ResolutionAction, TransactionMatchStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ReconciliationService } from "../reconciliation.service";

function buildDb(tx: any) {
  return {
    $transaction: vi.fn((callback) => callback(tx)),
  } as any;
}

describe("ReconciliationService", () => {
  it("allows only owners to resolve reconciliation records", async () => {
    const tx = {
      sepayTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "transaction-1",
          matchStatus: TransactionMatchStatus.UNMATCHED,
          resolutionAction: ResolutionAction.NONE,
          paymentId: "payment-1",
          differenceAmount: -10000n,
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "staff-1", role: "SERVICE_STAFF" }),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    await expect(
      new ReconciliationService(buildDb(tx)).resolveReconciliation("transaction-1", {
        resolvedByUserId: "staff-1",
        resolutionAction: ResolutionAction.REJECT,
        resolutionNote: "Not allowed",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("records an audit log when an owner resolves a reconciliation", async () => {
    const resolved = {
      id: "transaction-1",
      matchStatus: TransactionMatchStatus.REVIEWED,
      resolutionAction: ResolutionAction.ACCEPT,
      resolutionNote: "Accept underpayment for promo",
    };
    const tx = {
      sepayTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "transaction-1",
          matchStatus: TransactionMatchStatus.UNMATCHED,
          resolutionAction: ResolutionAction.NONE,
          paymentId: "payment-1",
          differenceAmount: -10000n,
        }),
        update: vi.fn().mockResolvedValue(resolved),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "owner-1", role: "OWNER" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1n }),
      },
    };

    await expect(
      new ReconciliationService(buildDb(tx)).resolveReconciliation("transaction-1", {
        resolvedByUserId: "owner-1",
        resolutionAction: ResolutionAction.ACCEPT,
        resolutionNote: " Accept underpayment for promo ",
      }),
    ).resolves.toEqual(resolved);

    expect(tx.sepayTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        matchStatus: TransactionMatchStatus.REVIEWED,
        resolutionAction: ResolutionAction.ACCEPT,
        resolutionNote: "Accept underpayment for promo",
        resolvedByUserId: "owner-1",
        resolvedAt: expect.any(Date),
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "owner-1",
        action: "RECONCILIATION_RESOLVED",
        entityType: "SEPAY_TRANSACTION",
        entityId: "transaction-1",
        details: expect.objectContaining({
          previousMatchStatus: TransactionMatchStatus.UNMATCHED,
          newMatchStatus: TransactionMatchStatus.REVIEWED,
          previousResolutionAction: ResolutionAction.NONE,
          resolutionAction: ResolutionAction.ACCEPT,
          resolutionNote: "Accept underpayment for promo",
          paymentId: "payment-1",
          differenceAmount: "-10000",
        }),
      }),
    });
  });
});
