"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader, Panel, Badge, EmptyState, orderPaymentTone, Field, Modal, PageLoading } from "@/components/ui";
import { PeriodFilter } from "@/components/PeriodFilter";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDate, formatTime } from "@/lib/format";
import { inPeriod, type Period } from "@/lib/period";
import {
  getOrders,
  getCurrentUser,
  cancelOrder,
  overrideOrderStatus,
  type ApiOrder,
  type ApiUser,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toOrder } from "@/lib/view-models";
import {
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUS_LABEL,
  type Order,
  type OrderPaymentStatus,
  type OrderFulfillmentStatus,
} from "@/lib/data";

const PAYMENT_STATUS_OPTIONS = Object.keys(ORDER_PAYMENT_STATUS_LABEL) as OrderPaymentStatus[];
const FULFILLMENT_STATUS_OPTIONS = Object.keys(ORDER_FULFILLMENT_STATUS_LABEL) as OrderFulfillmentStatus[];

function formatLocation(input: string | null) {
  if (!input) return "Bàn tự do";
  const lower = input.trim().toLowerCase();
  if (lower === "mang đi") return "Mang đi";
  
  const match = lower.match(/^(?:bàn|ban)\s*(\d+)$/);
  if (match) {
    return `Bàn ${match[1].padStart(2, '0')}`;
  }
  return "Bàn tự do";
}

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") ?? "");
  const [fulfillmentStatus, setFulfillmentStatus] = useState(searchParams.get("fulfillmentStatus") ?? "");
  const [period, setPeriod] = useState<Period | "">((searchParams.get("period") as Period) ?? "");
  const [needsAction, setNeedsAction] = useState(searchParams.get("needsAction") === "1");
  const [me, setMe] = useState<ApiUser | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
    if (period) params.set("period", period);
    if (needsAction) params.set("needsAction", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [q, paymentStatus, fulfillmentStatus, period, needsAction, pathname, router]);

  const load = useCallback(async () => {
    const [ordersPayload, mePayload] = await Promise.all([
      getOrders(500),
      getCurrentUser().catch(() => null),
    ]);
    setMe(mePayload?.data ?? null);
    return ordersPayload.data;
  }, []);

  const { data: apiRows, loading, error, reload } = useApiData<ApiOrder[]>(load, []);

  const rows: Order[] = useMemo(() => apiRows.map(toOrder), [apiRows]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
      if (fulfillmentStatus && o.fulfillmentStatus !== fulfillmentStatus) return false;
      if (needsAction && o.paymentStatus !== "PAYMENT_REVIEW" && o.fulfillmentStatus !== "QUEUED") return false;
      if (period && !inPeriod(o.createdAt, period)) return false;
      if (term) {
        const hay = `${o.code} ${o.user.username} ${o.user.telegramId} ${o.productName} ${o.user.firstName} ${o.user.lastName}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, paymentStatus, fulfillmentStatus, needsAction, period]);

  const stats = useMemo(() => {
    const revenue = filtered.filter((o) => o.fulfillmentStatus !== "CANCELLED").reduce((s, o) => s + o.amountVnd, 0);
    return {
      total: filtered.length,
      pendingPayment: filtered.filter((o) => o.paymentStatus === "UNPAID" || o.paymentStatus === "PENDING").length,
      needsReview: filtered.filter((o) => o.paymentStatus === "PAYMENT_REVIEW" || o.fulfillmentStatus === "QUEUED").length,
      delivered: filtered.filter((o) => o.fulfillmentStatus === "DELIVERED").length,
      revenue,
    };
  }, [filtered]);

  const hasFilters = Boolean(q || paymentStatus || fulfillmentStatus || needsAction || period);

  const act = async (orderId: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(orderId);
    try {
      await action();
      await reload();
      toast.push(success, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác.", "error");
    } finally {
      setBusyId(null);
    }
  };



  if (loading && rows.length === 0) {
    return <PageLoading label="Đang tải danh sách đơn hàng..." subText="Đang lấy thông tin đơn hàng và trạng thái pha chế..." />;
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader title="Đơn hàng" description="Theo dõi trạng thái thanh toán và quy trình thực hiện (xử lý/giao hàng) chuyên biệt.">
        <Link href="/orders/new" className="btn">+ Tạo đơn</Link>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {/* Tóm tắt */}
          <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <div className="flex items-baseline justify-between">
            <strong className="font-bold text-ink">Luồng đơn</strong>
            <span className="text-xs text-muted">{stats.total} đơn trong phạm vi hiện tại</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-amber-50 p-3">
              <dt className="text-xs font-medium text-amber-700">Chờ TT</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-amber-700">{stats.pendingPayment}</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <dt className="text-xs font-medium text-red-700">Cần xử lý</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-red-700">{stats.needsReview}</dd>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <dt className="text-xs font-medium text-emerald-700">Đã giao</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">{stats.delivered}</dd>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-baseline justify-between">
            <strong className="font-bold text-ink">Tài chính đơn hàng</strong>
            <span className="text-xs text-muted">Tính trên đơn hiển thị</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-600">Doanh thu</dt>
              <dd className="mt-1 text-lg font-extrabold tabular-nums text-ink">{formatVnd(stats.revenue)}</dd>
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-3">
              <dt className="text-xs font-medium text-emerald-800">Đơn cần xử lý</dt>
              <dd className={`mt-1 text-lg font-extrabold tabular-nums ${stats.needsReview > 0 ? "text-red-600" : "text-emerald-700"}`}>
                {stats.needsReview}
              </dd>
            </div>
          </div>
        </Panel>
      </div>

      {/* Bộ lọc */}
      <Panel className="mb-6">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3.5">
          <div className="w-full sm:w-[260px]">
            <Field label="Tìm kiếm">
              <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã đơn, sản phẩm..." />
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="TT Thanh toán">
              <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="">Tất cả thanh toán</option>
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{ORDER_PAYMENT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="TT Thực hiện">
              <select className="input" value={fulfillmentStatus} onChange={(e) => setFulfillmentStatus(e.target.value)}>
                <option value="">Tất cả thực hiện</option>
                {FULFILLMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{ORDER_FULFILLMENT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="w-full sm:w-72">
            <Field label="Thời gian">
              <PeriodFilter value={period} onChange={setPeriod} />
            </Field>
          </div>
          <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-line bg-slate-50/80">
            <input type="checkbox" id="needsActionOrders" checked={needsAction} onChange={(e) => setNeedsAction(e.target.checked)} className="h-4 w-4 rounded border-line accent-forest-800 cursor-pointer" />
            <label htmlFor="needsActionOrders" className="text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap">Chỉ đơn cần xử lý</label>
          </div>
          {hasFilters && (
            <button type="button" className="btn-ghost h-10 px-3.5" onClick={() => { setQ(""); setPaymentStatus(""); setFulfillmentStatus(""); setNeedsAction(false); setPeriod(""); }}>
              Xóa lọc
            </button>
          )}
        </form>
      </Panel>

      {/* Bảng đơn */}
      <Panel
        title="Danh sách đơn"
        right={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted"><strong className="text-ink">{filtered.length}</strong> đơn</span>
            <button type="button" className="btn-ghost text-xs" onClick={() => void reload()} disabled={loading}>
              Làm mới
            </button>
          </div>
        }
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Mã đơn</th>
                <th className="th">Vị trí</th>
                <th className="th">Món ăn / Đồ uống</th>
                <th className="th">Tổng tiền</th>
                <th className="th">Hình thức</th>
                <th className="th">Người tạo</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thời gian</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr><td colSpan={9}><EmptyState>Không có đơn phù hợp bộ lọc hiện tại.</EmptyState></td></tr>
              )}
              {filtered.map((order) => {
                const attention = order.paymentStatus === "PAYMENT_REVIEW";
                return (
                  <tr key={order.id} className={attention ? "bg-red-50/50" : "hover:bg-surface-soft transition-colors"}>
                    <td className="td whitespace-nowrap">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-bold text-ink transition hover:text-brand-700 hover:underline"
                        title="Xem chi tiết đơn"
                      >
                        {order.code}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap">
                      <span
                        className="inline-flex max-w-[140px] truncate rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60"
                        title={formatLocation(order.customerInput)}
                      >
                        {formatLocation(order.customerInput)}
                      </span>
                    </td>
                    <td className="td">
                      <strong className="text-sm text-ink">{order.productName}</strong>
                      <span className="ml-2 text-xs font-semibold text-slate-500">x{order.quantity}</span>
                    </td>
                    <td className="td font-bold tabular-nums text-slate-900">
                      {formatVnd(order.amountVnd)}
                    </td>
                    <td className="td text-xs font-medium text-slate-600">
                      {order.paymentMethod === "cash" ? "Tiền mặt" : "QR Code"}
                    </td>
                    <td className="td">
                      <strong className="text-xs font-semibold text-slate-800">@{order.user.username || order.user.telegramId}</strong>
                      <small className="block text-[11px] text-muted">{order.user.firstName} {order.user.lastName}</small>
                    </td>
                    <td className="td whitespace-nowrap">
                      <Badge tone={orderPaymentTone(order.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
                    </td>
                    <td className="td text-xs whitespace-nowrap">
                      <span className="block font-medium text-slate-700">{formatDate(order.createdAt)}</span>
                      <span className="block text-[11px] text-slate-400">{formatTime(order.createdAt)}</span>
                    </td>
                    <td className="td whitespace-nowrap">
                      <Link href={`/orders/${order.id}`} className="btn-ghost text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>


    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}
