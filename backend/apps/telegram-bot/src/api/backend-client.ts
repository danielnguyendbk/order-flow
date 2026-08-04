import type { EmployeeSession } from "../types.js";

export interface ApiErrorBody {
  message?: string;
  code?: string;
}

export interface BackendApi {
  createTelegramSession(telegramUserId: number): Promise<EmployeeSession>;
}

export class BackendApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export class BackendClient implements BackendApi {
  public constructor(
    private readonly baseUrl: string,
    private readonly internalSecret: string,
  ) {}

  async createTelegramSession(telegramUserId: number): Promise<EmployeeSession> {
    return this.request<EmployeeSession>("/telegram/session", {
      method: "POST",
      body: { telegramUserId },
    });
  }

  async get<T>(path: string, telegramUserId: number): Promise<T> {
    return this.request<T>(path, { telegramUserId });
  }

  async post<T>(path: string, telegramUserId: number, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", telegramUserId, body });
  }

  private async request<T>(
    path: string,
    options: { method?: "GET" | "POST"; telegramUserId?: number; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-bot-internal-secret": this.internalSecret,
        ...(options.telegramUserId ? { "x-telegram-user-id": String(options.telegramUserId) } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;
      throw new BackendApiError(
        payload.message ?? `Backend request failed (${response.status})`,
        response.status,
        payload.code,
      );
    }

    return response.json() as Promise<T>;
  }
}
