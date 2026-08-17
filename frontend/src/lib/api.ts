export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

interface ApiErrorPayload {
  message?: string;
  error?: {
    message?: string;
    details?: unknown;
  };
}

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
    const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
    if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }

    let errorMessage = payload?.error?.message ?? payload?.message ?? "Không thể tải dữ liệu từ máy chủ.";
    if (Array.isArray(payload?.error?.details)) {
      const issues = payload.error.details.map((detail: unknown) => {
        if (!detail || typeof detail !== "object") return String(detail);
        const record = detail as Record<string, unknown>;
        return `${String(record.path ?? "input")}: ${String(record.message ?? "không hợp lệ")}`;
      }).join(", ");
      if (issues) errorMessage += ` (${issues})`;
    }

    throw new ApiError(errorMessage, response.status);
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

export interface ApiOrderTimelineEntry {
  id: string;
  orderId: string;
  statusDomain: "PAYMENT" | "FULFILLMENT";
  oldStatus: string | null;
  newStatus: string;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ApiOrder {
  id: string;
  orderCode: string;
  createdByUserId: string;
  assignedBaristaId?: string | null;
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
  timeline?: ApiOrderTimelineEntry[];
}

export interface ApiSepayTransactionFull {
  id: string;
  sepayTransactionId: string;
  paymentId: string | null;
  transactionDate: string;
  code: string | null;
  content: string | null;
  amountIn: string;
  referenceCode: string | null;
  matchStatus: "UNMATCHED" | "MATCHED" | "WRONG_CODE" | "REVIEWED";
  differenceAmount: string | null;
  resolutionAction: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  receivedAt: string;
  payment: {
    id: string;
    paymentCode: string | null;
    expectedAmount: string;
    receivedAmount: string;
    order: { id: string; orderCode: string } | null;
  } | null;
  resolvedBy: { id: string; fullName: string; username: string | null } | null;
}

export interface ApiTimeRevenueItem {
  time: string;
  cashAmount: string;
  qrAmount: string;
  grossRevenue: string;
  refundedAmount: string;
  netRevenue: string;
  orderCount: number;
  refundCount: number;
}

export interface ApiRevenueReport {
  range: { from: string; to: string };
  summary: {
    grossRevenue: string;
    refundedAmount: string;
    netRevenue: string;
    paidOrderCount: number;
    refundCount: number;
    totalDays?: number;
    avgDailyNetRevenue?: string;
  };
  byMethod: {
    CASH: { amount: string; count: number };
    QR: { amount: string; count: number };
    REFUNDED: { amount: string; count: number };
  };
  byTime?: ApiTimeRevenueItem[];
}

export type DashboardRange = 7 | 30 | 90;

export interface ApiDashboardRevenuePoint {
  date: string;
  hour?: number;
  revenue: string;
  orderCount: number;
}

export interface ApiDashboard {
  generatedAt: string;
  timeZone: "Asia/Ho_Chi_Minh";
  range: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    paidOrderCount: number;
    grossRevenue: string;
  };
  revenueSeries: ApiDashboardRevenuePoint[];
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

/* ── Quản lý đơn hàng từ web (tạo / sửa món / hủy) ── */

export interface ApiCreateOrderItem {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface ApiCreateOrderInput {
  createdByUserId: string;
  paymentMethod?: "CASH" | "QR";
  customerNote?: string;
  items: ApiCreateOrderItem[];
}

export interface ApiOrderLite {
  id: string;
  orderCode: string;
  totalAmount: string;
}

export function createOrder(body: ApiCreateOrderInput) {
  return apiRequest<ApiOrderLite>("orders", { method: "POST", body });
}

export function addOrderItem(orderId: string, body: ApiCreateOrderItem) {
  return apiRequest<ApiOrderLite>(`orders/${orderId}/items`, { method: "POST", body });
}

export function updateOrderItem(
  orderId: string,
  itemId: string,
  body: { quantity?: number; note?: string | null },
) {
  return apiRequest<ApiOrderLite>(`orders/${orderId}/items/${itemId}`, { method: "PATCH", body });
}

export function deleteOrderItem(orderId: string, itemId: string) {
  return apiRequest<ApiOrderLite>(`orders/${orderId}/items/${itemId}`, { method: "DELETE" });
}

export function cancelOrder(orderId: string, body: { reason: string; requesterId?: string }) {
  return apiRequest<ApiOrderLite>(`orders/${orderId}/cancel`, { method: "POST", body });
}

/* ── Barista (web) ── */

export interface ApiBaristaOrder {
  id: string;
  orderCode: string;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "UNDERPAID" | "OVERPAID" | "REVIEW";
  fulfillmentStatus: "PENDING_PAYMENT" | "QUEUED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  totalAmount: string;
  customerNote: string | null;
  assignedBaristaId: string | null;
  createdAt: string;
  items: ApiOrderItem[];
}

export function getBaristaQueue() {
  return apiRequest<ApiBaristaOrder[]>("barista/queue");
}

export function getActiveBaristas() {
  return apiRequest<ApiUser[]>("barista/employees");
}

export function getBaristaOrders(baristaId: string) {
  return apiRequest<ApiBaristaOrder[]>(`barista/orders?baristaId=${encodeURIComponent(baristaId)}`);
}

export function claimOrder(orderId: string, body: { baristaId: string }) {
  return apiRequest<ApiBaristaOrder>(`orders/${orderId}/claim`, { method: "POST", body });
}

export function markOrderReady(orderId: string) {
  return apiRequest<ApiBaristaOrder>(`orders/${orderId}/ready`, { method: "POST" });
}

export function deliverOrder(orderId: string) {
  return apiRequest<ApiBaristaOrder>(`orders/${orderId}/deliver`, { method: "POST" });
}

export function getOrder(orderId: string) {
  return apiRequest<ApiOrder>(`admin/orders/${orderId}`);
}

/** Bản ghi thanh toán của một đơn (không kèm sepayTransactions). */
export interface ApiOrderPaymentRecord {
  id: string;
  orderId: string;
  paymentCode: string | null;
  expectedAmount: string;
  receivedAmount: string;
  cashConfirmedByUserId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getOrderPayments(orderId: string) {
  return apiRequest<{ data: ApiOrderPaymentRecord[] }>(`orders/${orderId}/payments`);
}

export function getCurrentUser() {
  return apiRequest<{ data: ApiUser }>("admin/auth/me");
}

export function getTransactions() {
  return apiRequest<{ data: ApiSepayTransactionFull[] }>("admin/transactions");
}

export function getTransaction(transactionId: string) {
  return apiRequest<ApiSepayTransactionFull>(`admin/transactions/${transactionId}`);
}

export function getReconciliations() {
  return apiRequest<{ data: ApiSepayTransactionFull[] }>("admin/reconciliations");
}

export function getReconciliation(reconciliationId: string) {
  return apiRequest<ApiSepayTransactionFull>(`admin/reconciliations/${reconciliationId}`);
}

export function getRevenueReport(from: string, to: string, groupBy: string = "day") {
  return apiRequest<{ data: ApiRevenueReport }>(
    `admin/reports/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${encodeURIComponent(groupBy)}`,
  );
}

export function getDashboard(days: DashboardRange, signal?: AbortSignal) {
  return apiRequest<{ data: ApiDashboard }>(`admin/dashboard?days=${days}`, { signal });
}

export async function downloadRevenueExport(
  from: string,
  to: string,
): Promise<void> {
  const response = await fetch(
    `/api/backend/admin/reports/revenue/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "xlsx" }),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new ApiError(payload?.error?.message ?? payload?.message ?? "Không thể xuất báo cáo.", response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    ?? "so-doanh-thu.xlsx";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function resolveReconciliation(
  reconciliationId: string,
  body: { resolvedByUserId: string; resolutionAction: string; resolutionNote: string },
) {
  return apiRequest<ApiSepayTransactionFull>(`admin/reconciliations/${reconciliationId}/resolve`, {
    method: "POST",
    body,
  });
}

export function refundOrder(orderId: string, body: { refundedByUserId: string; reason: string; amount?: number }) {
  return apiRequest<ApiOrder>(`admin/orders/${orderId}/refund`, { method: "POST", body });
}

export function confirmCash(orderId: string, body: { confirmedByUserId: string; amount?: number }) {
  return apiRequest<ApiOrder>(`orders/${orderId}/payments/cash/confirm`, { method: "POST", body });
}

export function initQrPayment(orderId: string, body: { requestedByUserId: string }) {
  return apiRequest<{ payment: ApiPayment; transferContent: string; amount: string }>(
    `orders/${orderId}/payments/qr`,
    { method: "POST", body },
  );
}

export function getCategories() {
  return apiRequest<{ data: ApiCategory[] }>("admin/menu-categories");
}

export function getMenuItems(limit = 100) {
  return apiRequest<Paginated<ApiMenuItem>>(`admin/menu-items?limit=${limit}`);
}

export function getMenuItem(itemId: string) {
  return apiRequest<{ data: ApiMenuItem }>(`admin/menu-items/${itemId}`);
}

export function getEmployees(limit = 100) {
  return apiRequest<Paginated<ApiUser>>(`admin/employees?limit=${limit}`);
}

export function getEmployee(employeeId: string) {
  return apiRequest<{ data: ApiUser }>(`admin/employees/${employeeId}`);
}

export function getAuditLogs() {
  return apiRequest<{ data: ApiAuditLog[] }>("admin/audit-logs");
}

/* ── Quản lý danh mục thực đơn (admin) ── */

export interface ApiCreateCategoryInput {
  name: string;
  displayOrder?: number;
  isActive?: boolean;
}

export function createCategory(body: ApiCreateCategoryInput) {
  return apiRequest<{ data: ApiCategory }>("admin/menu-categories", { method: "POST", body });
}

export function updateCategory(categoryId: string, body: Partial<ApiCreateCategoryInput>) {
  return apiRequest<{ data: ApiCategory }>(`admin/menu-categories/${categoryId}`, { method: "PATCH", body });
}

export function deleteCategory(categoryId: string) {
  return apiRequest<void>(`admin/menu-categories/${categoryId}`, { method: "DELETE" });
}

/* ── Quản lý món ăn / đồ uống (admin) ── */

export interface ApiCreateMenuItemInput {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
  displayOrder?: number;
}

export function createMenuItem(body: ApiCreateMenuItemInput) {
  return apiRequest<{ data: ApiMenuItem }>("admin/menu-items", { method: "POST", body });
}

export function updateMenuItem(itemId: string, body: Partial<ApiCreateMenuItemInput>) {
  return apiRequest<{ data: ApiMenuItem }>(`admin/menu-items/${itemId}`, { method: "PATCH", body });
}

export function deleteMenuItem(itemId: string) {
  return apiRequest<void>(`admin/menu-items/${itemId}`, { method: "DELETE" });
}

/* ── Quản lý nhân viên (admin) ── */

export interface ApiCreateEmployeeInput {
  fullName: string;
  telegramUserId: string;
  telegramChatId?: string | null;
  username?: string | null;
  role: "SERVICE_STAFF" | "BARISTA";
}

export function createEmployee(body: ApiCreateEmployeeInput) {
  return apiRequest<{ data: ApiUser }>("admin/employees", { method: "POST", body });
}

export function updateEmployee(employeeId: string, body: Partial<ApiCreateEmployeeInput>) {
  return apiRequest<{ data: ApiUser }>(`admin/employees/${employeeId}`, { method: "PATCH", body });
}

export function activateEmployee(employeeId: string) {
  return apiRequest<{ data: ApiUser }>(`admin/employees/${employeeId}/activate`, { method: "POST" });
}

export function deactivateEmployee(employeeId: string) {
  return apiRequest<{ data: ApiUser }>(`admin/employees/${employeeId}/deactivate`, { method: "POST" });
}

/* ── Admin override trạng thái đơn ── */

export function overrideOrderStatus(
  orderId: string,
  body: { domain: "PAYMENT" | "FULFILLMENT"; status: string; reason: string },
) {
  return apiRequest<ApiOrder>(`admin/orders/${orderId}/override-status`, { method: "POST", body });
}
