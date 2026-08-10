export interface SepayTransactionLookupInput {
  accountNumber: string;
  amount: bigint;
  paymentCode: string;
  createdAt: Date;
}

export interface SepayTransactionLookup {
  findIncomingTransaction(input: SepayTransactionLookupInput): Promise<Record<string, unknown> | null>;
}

export class SepayApiClientError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SepayApiClientError";
  }
}

interface SepayApiTransaction {
  id?: string | number;
  account_number?: string;
  transaction_date?: string;
  amount_in?: string | number;
  amount_out?: string | number;
  code?: string | null;
  transaction_content?: string;
  reference_number?: string | null;
  accumulated?: string | number;
  bank_brand_name?: string;
  sub_account?: string | null;
}

function integerAmount(value: string | number | undefined): bigint | null {
  if (value === undefined) return null;
  const normalized = String(value).trim();
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return null;
  return BigInt(normalized.split(".")[0]);
}

export class SepayApiClient implements SepayTransactionLookup {
  public constructor(
    private readonly apiToken: string = process.env.SEPAY_API_TOKEN?.trim() ?? "",
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://my.sepay.vn/userapi/transactions/list",
  ) {}

  public async findIncomingTransaction(input: SepayTransactionLookupInput): Promise<Record<string, unknown> | null> {
    if (!this.apiToken) {
      throw new SepayApiClientError(503, "SEPAY_API_NOT_CONFIGURED", "SePay API token is not configured");
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("account_number", input.accountNumber);
    url.searchParams.set("amount_in", input.amount.toString());
    url.searchParams.set("transaction_date_min", input.createdAt.toISOString().slice(0, 10));
    url.searchParams.set("limit", "100");

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.apiToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SepayApiClientError(502, "SEPAY_API_UNAVAILABLE", "Cannot connect to SePay transaction API");
    }

    if (!response.ok) {
      throw new SepayApiClientError(
        response.status === 401 || response.status === 403 ? 503 : 502,
        response.status === 401 || response.status === 403 ? "SEPAY_API_TOKEN_INVALID" : "SEPAY_API_UNAVAILABLE",
        `SePay transaction API returned HTTP ${response.status}`,
      );
    }

    const payload = await response.json().catch(() => null) as { transactions?: SepayApiTransaction[] } | null;
    if (!payload || !Array.isArray(payload.transactions)) {
      throw new SepayApiClientError(502, "SEPAY_API_RESPONSE_INVALID", "SePay transaction API returned invalid data");
    }

    const paymentCode = input.paymentCode.toUpperCase();
    const transaction = payload.transactions.find((candidate) => {
      const content = candidate.transaction_content?.toUpperCase() ?? "";
      const code = candidate.code?.toUpperCase() ?? "";
      const transactionDate = candidate.transaction_date ? new Date(candidate.transaction_date.replace(" ", "T") + "+07:00") : null;
      return (
        String(candidate.account_number ?? "") === input.accountNumber
        && integerAmount(candidate.amount_in) === input.amount
        && integerAmount(candidate.amount_out) === 0n
        && (code === paymentCode || content.includes(paymentCode))
        && transactionDate !== null
        && !Number.isNaN(transactionDate.getTime())
        && transactionDate.getTime() >= input.createdAt.getTime() - 60_000
      );
    });

    if (!transaction || transaction.id === undefined) return null;

    return {
      id: transaction.id,
      gateway: transaction.bank_brand_name,
      transactionDate: transaction.transaction_date,
      accountNumber: transaction.account_number,
      subAccount: transaction.sub_account,
      code: transaction.code,
      content: transaction.transaction_content,
      transferType: "in",
      transferAmount: integerAmount(transaction.amount_in)?.toString(),
      accumulated: transaction.accumulated,
      referenceCode: transaction.reference_number,
    };
  }
}
