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
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "SepayApiClientError";
  }
}

function retryAfterMilliseconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000);

  const retryAt = new Date(value).getTime();
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - Date.now());
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
  transfer_type?: "in" | "out";
}

function integerAmount(value: string | number | undefined): bigint | null {
  if (value === undefined) return null;
  const normalized = String(value).trim();
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return null;
  return BigInt(normalized.split(".")[0]);
}

function transactionTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(" ", "T")}+07:00`;
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sepayLocalDateTime(value: Date): string {
  return new Date(value.getTime() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

export class SepayApiClient implements SepayTransactionLookup {
  public constructor(
    private readonly apiToken: string = process.env.SEPAY_API_TOKEN?.trim() ?? "",
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = process.env.SEPAY_API_BASE_URL?.trim()
      || "https://userapi.sepay.vn/v2/transactions",
  ) {}

  public async findIncomingTransaction(input: SepayTransactionLookupInput): Promise<Record<string, unknown> | null> {
    if (!this.apiToken) {
      throw new SepayApiClientError(503, "SEPAY_API_NOT_CONFIGURED", "SePay API token is not configured");
    }

    const url = new URL(this.baseUrl);
    const isV2 = /\/v2\/transactions\/?$/.test(url.pathname);
    if (isV2) {
      url.searchParams.set("q", input.paymentCode);
      url.searchParams.set("amount_in_min", input.amount.toString());
      url.searchParams.set("amount_in_max", input.amount.toString());
      url.searchParams.set("transfer_type", "in");
      url.searchParams.set(
        "transaction_date_from",
        sepayLocalDateTime(new Date(input.createdAt.getTime() - 60_000)),
      );
      url.searchParams.set("transaction_date_sort", "desc");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("timestamp_format", "iso8601");
    } else {
      url.searchParams.set("account_number", input.accountNumber);
      url.searchParams.set("amount_in", input.amount.toString());
      url.searchParams.set("transaction_date_min", input.createdAt.toISOString().slice(0, 10));
      url.searchParams.set("limit", "100");
    }

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
      if (response.status === 429) {
        throw new SepayApiClientError(
          429,
          "SEPAY_API_RATE_LIMITED",
          "SePay transaction API rate limit reached",
          retryAfterMilliseconds(response.headers.get("retry-after")),
        );
      }
      throw new SepayApiClientError(
        response.status === 401 || response.status === 403 ? 503 : 502,
        response.status === 401 || response.status === 403 ? "SEPAY_API_TOKEN_INVALID" : "SEPAY_API_UNAVAILABLE",
        `SePay transaction API returned HTTP ${response.status}`,
      );
    }

    const payload = await response.json().catch(() => null) as {
      data?: SepayApiTransaction[];
      transactions?: SepayApiTransaction[];
    } | null;
    const transactions = isV2 ? payload?.data : payload?.transactions;
    if (!Array.isArray(transactions)) {
      throw new SepayApiClientError(502, "SEPAY_API_RESPONSE_INVALID", "SePay transaction API returned invalid data");
    }

    const paymentCode = input.paymentCode.toUpperCase();
    const transaction = transactions.find((candidate) => {
      const content = candidate.transaction_content?.toUpperCase() ?? "";
      const code = candidate.code?.toUpperCase() ?? "";
      const timestamp = transactionTimestamp(candidate.transaction_date);
      return (
        String(candidate.account_number ?? "") === input.accountNumber
        && integerAmount(candidate.amount_in) === input.amount
        && integerAmount(candidate.amount_out) === 0n
        && (candidate.transfer_type === undefined || candidate.transfer_type === "in")
        && (code === paymentCode || content.includes(paymentCode))
        && timestamp !== null
        && timestamp >= input.createdAt.getTime() - 60_000
      );
    });

    if (!transaction || transaction.id === undefined) return null;

    return {
      id: String(transaction.id),
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
