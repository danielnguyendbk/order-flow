"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader, Panel, Badge, EmptyState, orderPaymentTone } from "@/components/ui";
import { formatVnd, formatDate, formatTime } from "@/lib/format";
import { getOrders } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toOrder, toPayment } from "@/lib/view-models";
import { ORDER_PAYMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL, type Order, type Payment } from "@/lib/data";

export default function DashboardPage() {
  const load = useCallback(async () => (await getOrders()).data, []);
  const { data: apiOrders, loading, error, reload } = useApiData(load, []);
  const orders = useMemo(() => apiOrders.map(toOrder), [apiOrders]);
  const payments = useMemo(() => apiOrders.map(toPayment).filter((payment): payment is Payment => payment !== null), [apiOrders]);
  const stats = useMemo(() => {
    const paid = orders.filter((order) => order.paymentStatus === "PAID");
    const revenue = paid.reduce((sum, order) => sum + order.paidAmount, 0);
    return {
      revenue,
      paidOrders: paid.length,
      average: paid.length ? Math.round(revenue / paid.length) : 0,
      pending: orders.filter((order) => ["UNPAID", "PENDING"].includes(order.paymentStatus)).length,
      needsAction: orders.filter((order) => order.paymentStatus === "PAYMENT_REVIEW" || ["UNDERPAID", "OVERPAID"].includes(order.paymentStatus)).length,
      queued: orders.filter((order) => order.fulfillmentStatus === "QUEUED").length,
    };
  }, [orders]);
  const chart = useMemo(() => {
    const grouped = new Map<string, { amount: number; count: number }>();
    for (const order of orders.filter((item) => item.paymentStatus === "PAID")) {
      const key = order.createdAt.slice(0, 10);
      const current = grouped.get(key) ?? { amount: 0, count: 0 };
      grouped.set(key, { amount: current.amount + order.paidAmount, count: current.count + 1 });
    }
    const rows = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
    const peak = Math.max(...rows.map(([, value]) => value.amount), 1);
    return rows.map(([date, value]) => ({ date, ...value, height: Math.max(5, Math.round(value.amount / peak * 100)) }));
  }, [orders]);
  const alerts = payments.filter((payment) => ["underpaid", "overpaid", "unknown_code", "failed"].includes(payment.status)).slice(0, 4);

  return <div>
    <PageHeader title="Tổng quan kinh doanh" description="Số liệu thực từ Supabase, cập nhật mỗi lần tải trang."><button className="btn-ghost" onClick={() => void reload()}>Làm mới</button></PageHeader>
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading && <div className="mb-4 text-sm text-muted">Đang đọc dữ liệu thật từ Supabase...</div>}
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Doanh thu đã thu" value={formatVnd(stats.revenue)} hint={`${stats.paidOrders} đơn đã thanh toán`} />
      <Metric label="Trung bình / đơn" value={formatVnd(stats.average)} hint="Theo các đơn đã thanh toán" />
      <Metric label="Chờ thanh toán" value={String(stats.pending)} hint="Đơn chưa hoàn tất thanh toán" />
      <Metric label="Đang chờ pha chế" value={String(stats.queued)} hint={`${stats.needsAction} khoản cần kiểm tra`} />
    </div>
    <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel className="xl:col-span-2" title="Doanh thu theo ngày" subtitle="Tối đa 7 ngày có dữ liệu gần nhất">
        {chart.length === 0 ? <EmptyState>Chưa có đơn đã thanh toán.</EmptyState> : <div className="flex h-56 items-end gap-3 pt-8">{chart.map((point) => <div key={point.date} className="flex h-full flex-1 flex-col justify-end"><div className="flex flex-1 items-end"><div className="w-full rounded-t bg-brand-600" style={{ height: `${point.height}%` }} title={`${formatVnd(point.amount)} · ${point.count} đơn`} /></div><span className="mt-2 text-center text-xs text-muted">{new Date(point.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span></div>)}</div>}
      </Panel>
      <Panel title="Cần chú ý">
        <div className="space-y-2">{alerts.map((payment) => <Link key={payment.id} href={`/payments?q=${encodeURIComponent(payment.code)}`} className="flex items-center justify-between rounded-lg border border-line p-3"><span><strong className="block text-sm">{payment.code}</strong><small className="text-muted">{formatVnd(payment.amountReceived)}</small></span><Badge tone="red">{PAYMENT_STATUS_LABEL[payment.status]}</Badge></Link>)}{alerts.length === 0 && <EmptyState>Không có khoản lệch.</EmptyState>}</div>
      </Panel>
    </div>
    <Panel title="Đơn mới nhất" right={<Link href="/orders" className="text-sm text-brand-700">Xem tất cả</Link>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead><tr className="border-b border-line"><th className="th">Mã đơn</th><th className="th">Người tạo</th><th className="th">Món</th><th className="th">Tổng tiền</th><th className="th">Trạng thái</th></tr></thead><tbody className="divide-y divide-line-soft">{orders.slice(0, 8).map((order: Order) => <tr key={order.id}><td className="td"><strong className="block">{order.code}</strong><small className="text-muted">{formatDate(order.createdAt)} {formatTime(order.createdAt)}</small></td><td className="td">@{order.user.username || order.user.telegramId}</td><td className="td">{order.productName}</td><td className="td font-bold">{formatVnd(order.amountVnd)}</td><td className="td"><Badge tone={orderPaymentTone(order.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge></td></tr>)}{orders.length === 0 && !loading && <tr><td colSpan={5}><EmptyState>Supabase chưa có đơn hàng.</EmptyState></td></tr>}</tbody></table></div>
    </Panel>
  </div>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <article className="card p-5"><span className="text-xs font-medium text-muted">{label}</span><strong className="mt-2 block text-2xl font-extrabold text-ink">{value}</strong><small className="mt-1 block text-muted">{hint}</small></article>;
}
