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
    const client = new SepayApiClient("token", fetchImpl, "https://my.sepay.vn/userapi/transactions/list");

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

  it("uses the SePay v2 live endpoint by default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 }));

    await new SepayApiClient("token", fetchImpl).findIncomingTransaction(input);

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "userapi.sepay.vn", pathname: "/v2/transactions" }),
      expect.anything(),
    );
  });

  it("does not accept a same-amount transaction with a different payment code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      transactions: [
        { id: "2", account_number: input.accountNumber, transaction_date: "2026-08-10 22:37:00", amount_in: "5000", amount_out: "0", transaction_content: "PAY2608100000" },
      ],
    }), { status: 200 }));

    await expect(new SepayApiClient(
      "token",
      fetchImpl,
      "https://my.sepay.vn/userapi/transactions/list",
    ).findIncomingTransaction(input)).resolves.toBeNull();
  });

  it("supports SePay API v2 Sandbox responses and UUID transaction IDs", async () => {
    const transactionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: [
        {
          id: transactionId,
          account_number: input.accountNumber,
          transaction_date: "2026-08-10T22:37:00+07:00",
          transfer_type: "in",
          amount_in: 5_000,
          amount_out: 0,
          code: input.paymentCode,
          transaction_content: input.paymentCode,
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new SepayApiClient(
      "sandbox-token",
      fetchImpl,
      "https://userapi-sandbox.sepay.vn/v2/transactions",
    );

    await expect(client.findIncomingTransaction(input)).resolves.toMatchObject({
      id: transactionId,
      transferAmount: "5000",
      transferType: "in",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "userapi-sandbox.sepay.vn",
        pathname: "/v2/transactions",
        searchParams: expect.any(URLSearchParams),
      }),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer sandbox-token" }) }),
    );
    const requestedUrl = fetchImpl.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.searchParams.get("q")).toBe(input.paymentCode);
    expect(requestedUrl.searchParams.get("amount_in_min")).toBe("5000");
    expect(requestedUrl.searchParams.get("amount_in_max")).toBe("5000");
    expect(requestedUrl.searchParams.get("transfer_type")).toBe("in");
    expect(requestedUrl.searchParams.get("transaction_date_from")).toBe("2026-08-10 22:35:13");
  });

  it("accepts a matching transaction timestamped within the 60-second clock-skew window", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: [
        {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          account_number: input.accountNumber,
          transaction_date: "2026-08-10T22:35:30+07:00",
          transfer_type: "in",
          amount_in: 5_000,
          amount_out: 0,
          code: input.paymentCode,
          transaction_content: input.paymentCode,
        },
      ],
    }), { status: 200 }));

    await expect(new SepayApiClient(
      "token",
      fetchImpl,
      "https://userapi.sepay.vn/v2/transactions",
    ).findIncomingTransaction(input)).resolves.toMatchObject({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
  });

  it("surfaces SePay rate limits with the requested retry delay", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, {
      status: 429,
      headers: { "retry-after": "12" },
    }));

    await expect(new SepayApiClient("token", fetchImpl).findIncomingTransaction(input))
      .rejects.toMatchObject<SepayApiClientError>({
        statusCode: 429,
        code: "SEPAY_API_RATE_LIMITED",
        retryAfterMs: 12_000,
      });
  });

  it("fails closed when the API token is missing", async () => {
    await expect(new SepayApiClient("").findIncomingTransaction(input)).rejects.toMatchObject<SepayApiClientError>({
      statusCode: 503,
      code: "SEPAY_API_NOT_CONFIGURED",
    });
  });
});
