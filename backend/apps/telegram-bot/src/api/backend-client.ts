import type { EmployeeSession } from "../types.js";
import type {
  BaristaOrder,
  BaristaOrderHistory,
  CreateOrderItemInput,
  DraftOrder,
  MenuCategory,
  MenuItem,
  QrPaymentResult,
  UpdateOrderItemInput,
} from "./order-types.js";

export interface ApiErrorBody {
  message?: string;
  code?: string;
}

export interface BackendApi {
  createTelegramSession(telegramUserId: number): Promise<EmployeeSession>;
  createDraftOrder(telegramUserId: number): Promise<DraftOrder>;
  getMenuCategories(telegramUserId: number): Promise<MenuCategory[]>;
  getMenuItems(telegramUserId: number, categoryId: string): Promise<MenuItem[]>;
  addDraftOrderItem(telegramUserId: number, orderId: string, input: CreateOrderItemInput): Promise<DraftOrder>;
  updateDraftOrderItem(telegramUserId: number, orderId: string, itemId: string, input: UpdateOrderItemInput): Promise<DraftOrder>;
  deleteDraftOrderItem(telegramUserId: number, orderId: string, itemId: string): Promise<DraftOrder>;
  getDraftOrder(telegramUserId: number, orderId: string): Promise<DraftOrder>;
  cancelDraftOrder(telegramUserId: number, orderId: string): Promise<void>;
  listMyOrders(telegramUserId: number): Promise<DraftOrder[]>;
  confirmCashPayment(telegramUserId: number, orderId: string): Promise<DraftOrder>;
  createQrPayment(telegramUserId: number, orderId: string): Promise<QrPaymentResult>;
  deliverOrder(telegramUserId: number, orderId: string): Promise<DraftOrder>;
  listBaristaQueue(telegramUserId: number): Promise<BaristaOrder[]>;
  listBaristaOrders(telegramUserId: number): Promise<BaristaOrder[]>;
  getBaristaOrder(telegramUserId: number, orderId: string): Promise<BaristaOrder>;
  getBaristaOrderHistory(telegramUserId: number, orderId: string): Promise<BaristaOrderHistory[]>;
  claimBaristaOrder(telegramUserId: number, orderId: string): Promise<BaristaOrder>;
  markBaristaOrderReady(telegramUserId: number, orderId: string): Promise<BaristaOrder>;
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
    const session = await this.request<unknown>("/telegram/session", {
      method: "POST",
      body: { telegramUserId },
    });
    if (!isEmployeeSession(session)) {
      throw new BackendApiError("Backend returned an invalid Telegram session", 502, "SESSION_RESPONSE_INVALID");
    }
    return session;
  }

  createDraftOrder(telegramUserId: number): Promise<DraftOrder> {
    return this.post<DraftOrder>("/orders", telegramUserId);
  }

  getMenuCategories(telegramUserId: number): Promise<MenuCategory[]> {
    return this.get<MenuCategory[]>("/menu/categories", telegramUserId);
  }

  getMenuItems(telegramUserId: number, categoryId: string): Promise<MenuItem[]> {
    return this.get<MenuItem[]>(`/menu/items?categoryId=${encodeURIComponent(categoryId)}`, telegramUserId);
  }

  addDraftOrderItem(telegramUserId: number, orderId: string, input: CreateOrderItemInput): Promise<DraftOrder> {
    return this.post<DraftOrder>(`/orders/${encodeURIComponent(orderId)}/items`, telegramUserId, input);
  }

  updateDraftOrderItem(
    telegramUserId: number,
    orderId: string,
    itemId: string,
    input: UpdateOrderItemInput,
  ): Promise<DraftOrder> {
    return this.patch<DraftOrder>(`/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, telegramUserId, input);
  }

  deleteDraftOrderItem(telegramUserId: number, orderId: string, itemId: string): Promise<DraftOrder> {
    return this.delete<DraftOrder>(`/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, telegramUserId);
  }

  getDraftOrder(telegramUserId: number, orderId: string): Promise<DraftOrder> {
    return this.get<DraftOrder>(`/orders/${encodeURIComponent(orderId)}`, telegramUserId);
  }

  async cancelDraftOrder(telegramUserId: number, orderId: string): Promise<void> {
    await this.post<void>(`/orders/${encodeURIComponent(orderId)}/cancel`, telegramUserId);
  }

  listMyOrders(telegramUserId: number): Promise<DraftOrder[]> {
    return this.get<DraftOrder[]>("/orders?mine=true", telegramUserId);
  }

  confirmCashPayment(telegramUserId: number, orderId: string): Promise<DraftOrder> {
    return this.post<DraftOrder>(`/orders/${encodeURIComponent(orderId)}/payments/cash/confirm`, telegramUserId);
  }

  createQrPayment(telegramUserId: number, orderId: string): Promise<QrPaymentResult> {
    return this.post<QrPaymentResult>(`/orders/${encodeURIComponent(orderId)}/payments/qr`, telegramUserId);
  }

  deliverOrder(telegramUserId: number, orderId: string): Promise<DraftOrder> {
    return this.post<DraftOrder>(`/orders/${encodeURIComponent(orderId)}/deliver`, telegramUserId);
  }

  listBaristaQueue(telegramUserId: number): Promise<BaristaOrder[]> {
    return this.get<BaristaOrder[]>("/barista/queue", telegramUserId);
  }

  listBaristaOrders(telegramUserId: number): Promise<BaristaOrder[]> {
    return this.get<BaristaOrder[]>("/barista/orders", telegramUserId);
  }

  getBaristaOrder(telegramUserId: number, orderId: string): Promise<BaristaOrder> {
    return this.get<BaristaOrder>(`/barista/orders/${encodeURIComponent(orderId)}`, telegramUserId);
  }

  getBaristaOrderHistory(telegramUserId: number, orderId: string): Promise<BaristaOrderHistory[]> {
    return this.get<BaristaOrderHistory[]>(`/barista/orders/${encodeURIComponent(orderId)}/history`, telegramUserId);
  }

  claimBaristaOrder(telegramUserId: number, orderId: string): Promise<BaristaOrder> {
    return this.post<BaristaOrder>(`/orders/${encodeURIComponent(orderId)}/claim`, telegramUserId);
  }

  markBaristaOrderReady(telegramUserId: number, orderId: string): Promise<BaristaOrder> {
    return this.post<BaristaOrder>(`/orders/${encodeURIComponent(orderId)}/ready`, telegramUserId);
  }

  async get<T>(path: string, telegramUserId: number): Promise<T> {
    return this.request<T>(path, { telegramUserId });
  }

  async post<T>(path: string, telegramUserId: number, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", telegramUserId, body });
  }

  async patch<T>(path: string, telegramUserId: number, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", telegramUserId, body });
  }

  async delete<T>(path: string, telegramUserId: number): Promise<T> {
    return this.request<T>(path, { method: "DELETE", telegramUserId });
  }

  private async request<T>(
    path: string,
    options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; telegramUserId?: number; body?: unknown } = {},
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

function isEmployeeSession(value: unknown): value is EmployeeSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<EmployeeSession>;
  return (
    typeof session.employeeId === "string" &&
    session.employeeId.length > 0 &&
    Number.isSafeInteger(session.telegramUserId) &&
    Number(session.telegramUserId) > 0 &&
    typeof session.displayName === "string" &&
    session.displayName.length > 0 &&
    ["SERVICE_STAFF", "BARISTA", "MANAGER"].includes(session.role ?? "")
  );
}
