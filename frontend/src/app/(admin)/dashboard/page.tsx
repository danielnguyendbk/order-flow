"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge, orderPaymentTone, PageHeader, PageLoading, Spinner } from "@/components/ui";
import { formatVnd, formatTime, formatDate } from "@/lib/format";
import { getOrders, getTransactions, type ApiOrder, type ApiSepayTransactionFull } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { ORDER_PAYMENT_STATUS_LABEL } from "@/lib/data";
import RevenueChart from "./revenue-chart";

interface DashboardPayload {
  orders: ApiOrder[];
  transactions: ApiSepayTransactionFull[];
}

const AVATAR_COLORS = [
  "from-brand-400 to-brand-600",
  "from-amber-400 to-orange-500",
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-red-500",
  "from-violet-400 to-purple-600",
];

function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/* ── Mũi tên xu hướng ── */
function Trend({ up, children }: { up: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        up ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
      }`}
    >
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${up ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 9l8-8M4.5 1H10v5.5" />
      </svg>
      {children}
    </span>
  );
}

/* ── Đơn hàng gần đây ── */
function RecentOrders({ orders }: { orders: ApiOrder[] }) {
  return (
    <section className="card self-start p-4 sm:p-5" aria-labelledby="recent-orders-title">
      <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-3">
        <div className="min-w-0">
          <h2 id="recent-orders-title" className="text-[15px] font-bold text-ink">Đơn hàng gần đây</h2>
          <p className="mt-0.5 text-xs text-muted">5 đơn mới nhất</p>
        </div>
        <Link
          href="/orders"
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          Xem tất cả <span aria-hidden>→</span>
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-line-soft">
        {orders.length === 0 && <li className="py-6 text-center text-sm text-muted">Chưa có đơn hàng nào.</li>}
        {orders.map((order, i) => (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              title={`${order.orderCode} · ${order.items.map((item) => item.itemName).join(", ") || "Chưa có món"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
              >
                {initialsOf(order.creator.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink transition group-hover:text-brand-800">
                  {order.orderCode} · {order.items.map((item) => item.itemName).join(", ") || "Chưa có món"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  @{order.creator.username ?? "—"} · {formatTime(order.createdAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-ink">{formatVnd(Number(order.totalAmount))}</p>
                <div className="mt-1 flex justify-end">
                  <Badge tone={orderPaymentTone(order.paymentStatus === "REVIEW" ? "PAYMENT_REVIEW" : order.paymentStatus)}>
                    {ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus === "REVIEW" ? "PAYMENT_REVIEW" : order.paymentStatus]}
                  </Badge>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Panel cần chú ý (giao dịch thiếu/thừa/sai mã) ── */
function AttentionPanel({ transactions }: { transactions: ApiSepayTransactionFull[] }) {
  const items = useMemo(() => {
    return transactions
      .filter((tx) => {
        const received = Number(tx.amountIn);
        const expected = Number(tx.payment?.expectedAmount ?? 0);
        if (tx.matchStatus === "WRONG_CODE") return true;
        if (tx.matchStatus === "REVIEWED") return true;
        if (tx.payment && received !== expected) return true;
        return false;
      })
      .slice(0, 5);
  }, [transactions]);

  const tone = (tx: ApiSepayTransactionFull): "amber" | "red" => {
    const diff = Number(tx.amountIn) - Number(tx.payment?.expectedAmount ?? 0);
    if (tx.matchStatus === "WRONG_CODE" || diff < 0) return "red";
    return "amber";
  };

  return (
    <section className="card flex h-full flex-col justify-between p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Cần chú ý</h2>
          <p className="mt-0.5 text-sm text-muted">Giao dịch thiếu / thừa / sai mã</p>
        </div>
        <Link href="/payments?needsReview=1" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
          Xem tất cả →
        </Link>
      </div>
      <ul className="divide-y divide-line-soft">
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">Không có giao dịch nào cần xử lý. 🎉</li>
        )}
        {items.map((tx) => {
          const diff = Number(tx.amountIn) - Number(tx.payment?.expectedAmount ?? 0);
          return (
            <li key={tx.id}>
              <Link
                href={`/payments?q=${encodeURIComponent(tx.code ?? tx.sepayTransactionId)}`}
                className="flex items-center gap-3 rounded-lg py-3 transition hover:bg-slate-50"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${tone(tx) === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                  {tx.matchStatus === "WRONG_CODE" ? "⚠" : diff < 0 ? "↓" : "↑"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{tx.code ?? `SP${tx.sepayTransactionId}`}</p>
                  <p className="text-xs text-muted">
                    {tx.payment?.order?.orderCode ?? "Chưa liên kết"} · {formatDate(tx.receivedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">{formatVnd(Number(tx.amountIn))}</p>
                  <Badge tone={tone(tx)}>
                    {tx.matchStatus === "WRONG_CODE" ? "Sai mã" : diff < 0 ? "Thiếu" : "Thừa"}
                  </Badge>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Thẻ KPI ── */
function KpiCard({
  label,
  value,
  trend,
  up,
  sub,
  dark = false,
}: {
  label: string;
  value: string;
  trend?: string;
  up?: boolean;
  sub: string;
  dark?: boolean;
}) {
  return dark ? (
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-700 to-forest-950 p-5 text-white shadow-lg shadow-forest-900/30 transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand-400/15 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-brand-300/10 blur-xl" aria-hidden />
      <div className="relative flex items-start justify-between">
        <span className="text-xs font-medium text-brand-200/80">{label}</span>
        {trend && <Trend up={up ?? true}>{trend}</Trend>}
      </div>
      <strong className="relative mt-3 block text-[28px] font-extrabold tabular-nums tracking-tight">{value}</strong>
      <p className="relative mt-1 text-xs text-brand-200/60">{sub}</p>
    </article>
  ) : (
    <article className="card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,61,36,0.1)]">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {trend && <Trend up={up ?? true}>{trend}</Trend>}
      </div>
      <strong className="mt-3 block text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{value}</strong>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </article>
  );
}

export default function DashboardPage() {
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const load = useCallback(async (): Promise<DashboardPayload> => {
    const [orders, transactions] = await Promise.all([
      getOrders(1000),
      getTransactions(),
    ]);
    return { orders: orders.data, transactions: transactions.data };
  }, []);

  const { data, loading, error, reload } = useApiData<DashboardPayload>(load, {
    orders: [] as ApiOrder[],
    transactions: [] as ApiSepayTransactionFull[],
  });

  const stats = useMemo(() => {
    const paid = data.orders.filter((o) => o.paymentStatus === "PAID");
    const revenue = paid.reduce((s, o) => s + Number(o.totalAmount), 0);
    const pendingPayment = data.orders.filter((o) => o.paymentStatus === "UNPAID" || o.paymentStatus === "PENDING").length;
    const queued = data.orders.filter((o) => o.fulfillmentStatus === "QUEUED").length;
    const avgOrder = paid.length > 0 ? Math.round(revenue / paid.length) : 0;
    return { revenue, avgOrder, pendingPayment, queued, paidCount: paid.length, totalOrders: data.orders.length };
  }, [data.orders]);

  const recent = useMemo(() => [...data.orders].slice(0, 5), [data.orders]);

  if (loading && data.orders.length === 0) {
    return <PageLoading label="Đang tải dữ liệu tổng quan..." subText="Đang lấy danh sách đơn hàng và giao dịch mới nhất..." />;
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader title="Tổng quan" description="Theo dõi doanh thu, đơn hàng và giao dịch cần xử lý theo thời gian thực.">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void reload();
            setChartRefreshKey((value) => value + 1);
          }}
          disabled={loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner size="sm" /> Đang tải...
            </span>
          ) : (
            "Làm mới"
          )}
        </button>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {/* KPI row */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              dark
              label="Doanh thu đã thu"
              value={formatVnd(stats.revenue)}
              sub={`${stats.paidCount} đơn đã thanh toán`}
            />
            <KpiCard label="TB / đơn" value={formatVnd(stats.avgOrder)} sub="trung bình trên đơn đã thu" />
            <KpiCard label="Chờ thanh toán" value={String(stats.pendingPayment)} sub="đơn chưa thanh toán" />
            <KpiCard label="Đang chờ pha chế" value={String(stats.queued)} sub="đơn trong hàng đợi barista" />
          </div>

          {/* Row 2: chart + recent orders */}
          <div className="mb-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
            <div className="flex flex-col xl:col-span-2">
              <RevenueChart refreshKey={chartRefreshKey} />
            </div>
            <RecentOrders orders={recent} />
          </div>

          {/* Row 3: attention panel + stats */}
          <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
            <div className="flex flex-col xl:col-span-2">
              <AttentionPanel transactions={data.transactions} />
            </div>
            <section className="card flex h-full flex-col justify-between p-6">
              <h2 className="text-[15px] font-bold text-ink">Tổng quan nhanh</h2>
              <dl className="mt-4 space-y-3">
                {[
                  { label: "Tổng đơn hàng", value: stats.totalOrders },
                  { label: "Đơn đã thanh toán", value: stats.paidCount },
                  { label: "Đang pha chế (PREPARING)", value: data.orders.filter((o) => o.fulfillmentStatus === "PREPARING").length },
                  { label: "Sẵn sàng giao (READY)", value: data.orders.filter((o) => o.fulfillmentStatus === "READY").length },
                  { label: "Đã giao (DELIVERED)", value: data.orders.filter((o) => o.fulfillmentStatus === "DELIVERED").length },
                  { label: "Đã hủy (CANCELLED)", value: data.orders.filter((o) => o.fulfillmentStatus === "CANCELLED").length },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                    <span className="text-sm text-muted">{row.label}</span>
                    <strong className="font-bold tabular-nums text-ink">{row.value}</strong>
                  </div>
                ))}
              </dl>
            </section>
          </div>
    </div>
  );
}
