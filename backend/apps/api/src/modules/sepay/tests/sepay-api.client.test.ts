import { describe, expect, it, vi } from "vitest";

import { SepayApiClient, SepayApiClientError } from "../sepay-api.client";

const input = {
  accountNumber: "0337990731",
  amount: 5_000n,
  paymentCode: "PAY2608109950",
  createdAt: new Date("2026-08-10T15:36:13.000Z"),
};

describe("SepayApiClient", () => {
  it("returns only an incoming transaction matching account, amount, code and time", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      transactions: [
        { id: "1", account_number: input.accountNumber, transaction_date: "2026-08-10 22:37:00", amount_in: "5000.00", amount_out: "0.00", code: null, transaction_content: `MBVCB ${input.paymentCode}`, reference_number: "REF1" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new SepayApiClient("token", fetchImpl);

    await expect(client.findIncomingTransaction(input)).resolves.toMatchObject({
      id: "1",
      transferAmount: "5000",
      content: `MBVCB ${input.paymentCode}`,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/userapi/transactions/list" }),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer token" }) }),
    );
  });

  it("does not accept a same-amount transaction with a different payment code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      transactions: [
        { id: "2", account_number: input.accountNumber, transaction_date: "2026-08-10 22:37:00", amount_in: "5000", amount_out: "0", transaction_content: "PAY2608100000" },
      ],
    }), { status: 200 }));

    await expect(new SepayApiClient("token", fetchImpl).findIncomingTransaction(input)).resolves.toBeNull();
  });

  it("fails closed when the API token is missing", async () => {
    await expect(new SepayApiClient("").findIncomingTransaction(input)).rejects.toMatchObject<SepayApiClientError>({
      statusCode: 503,
      code: "SEPAY_API_NOT_CONFIGURED",
    });
  });
});
