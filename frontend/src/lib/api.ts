export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`/api/backend/${path.replace(/^\//, "")}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new ApiError(payload?.error?.message ?? payload?.message ?? "Không thể tải dữ liệu từ máy chủ.", response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface ApiUser {
  id: string;
  fullName: string;
  username: string | null;
  telegramUserId: string | null;
  telegramChatId?: string | null;
  role: "OWNER" | "SERVICE_STAFF" | "BARISTA";
  status?: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface ApiOrderItem {
  id: string;
  itemName: string;
  unitPrice: string;
  quantity: number;
  note: string | null;
}

export interface ApiSepayTransaction {
  id: string;
  sepayTransactionId: string;
  amountIn: string;
  matchStatus: "UNMATCHED" | "MATCHED" | "WRONG_CODE" | "REVIEWED";
  receivedAt: string;
}

export interface ApiPayment {
  id: string;
  paymentCode: string | null;
  expectedAmount: string;
  receivedAmount: string;
  confirmedAt: string | null;
  createdAt: string;
  sepayTransactions: ApiSepayTransaction[];
}

export interface ApiOrder {
  id: string;
  orderCode: string;
  createdByUserId: string;
  paymentMethod: "QR" | "CASH" | null;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "UNDERPAID" | "OVERPAID" | "REVIEW";
  fulfillmentStatus: "PENDING_PAYMENT" | "QUEUED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  totalAmount: string;
  customerNote: string | null;
  cancellationReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: ApiUser;
  items: ApiOrderItem[];
  payment: ApiPayment | null;
}

export interface ApiCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  imageUrl: string | null;
  displayOrder: number;
}

export interface ApiAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
  actor: ApiUser | null;
}

export interface Paginated<T> {
  data: T[];
  total?: number;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

export function getOrders(limit = 100) {
  return apiRequest<Paginated<ApiOrder>>(`admin/orders?limit=${limit}`);
}

export function getCategories() {
  return apiRequest<{ data: ApiCategory[] }>("admin/menu-categories");
}

export function getMenuItems(limit = 100) {
  return apiRequest<Paginated<ApiMenuItem>>(`admin/menu-items?limit=${limit}`);
}

export function getEmployees(limit = 100) {
  return apiRequest<Paginated<ApiUser>>(`admin/employees?limit=${limit}`);
}

export function getAuditLogs() {
  return apiRequest<{ data: ApiAuditLog[] }>("admin/audit-logs");
}
