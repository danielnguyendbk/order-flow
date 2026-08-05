"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Panel, Badge, EmptyState, orderPaymentTone, orderFulfillmentTone } from "@/components/ui";
import { formatVnd, formatDateTime, formatDate, formatTime } from "@/lib/format";
import {
  dashboardStats as stats,
  revenueChartPoints,
  dashboardHealth as health,
  recentOrders,
  recentPaymentAlerts,
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/data";

const PERIODS = {
  day: {
    label: "Theo ngày",
    range: "7 ngày qua",
    summary: { totalRevenueVnd: 144000000, totalOrders: 142, averageOrderVnd: 1088028, peakRevenueVnd: 25000000, peakLabel: "Chủ Nhật" },
    points: revenueChartPoints,
  },
  week: {
    label: "Theo tuần",
    range: "8 tuần qua",
    summary: { totalRevenueVnd: 476000000, totalOrders: 408, averageOrderVnd: 1166666, peakRevenueVnd: 72000000, peakLabel: "Tuần 30" },
    points: [
      { label: "T23", revenueVnd: 52000000, orderCount: 45, heightPct: 72 },
      { label: "T24", revenueVnd: 58000000, orderCount: 51, heightPct: 81 },
      { label: "T25", revenueVnd: 49000000, orderCount: 42, heightPct: 68 },
      { label: "T26", revenueVnd: 61000000, orderCount: 55, heightPct: 85 },
      { label: "T27", revenueVnd: 66000000, orderCount: 58, heightPct: 92 },
      { label: "T28", revenueVnd: 54000000, orderCount: 47, heightPct: 75 },
      { label: "T29", revenueVnd: 59000000, orderCount: 52, heightPct: 82 },
      { label: "T30", revenueVnd: 72000000, orderCount: 61, heightPct: 100 },
    ],
  },
  month: {
    label: "Theo tháng",
    range: "6 tháng qua",
    summary: { totalRevenueVnd: 892000000, totalOrders: 774, averageOrderVnd: 1152455, peakRevenueVnd: 168000000, peakLabel: "Tháng 7" },
    points: [
      { label: "T2", revenueVnd: 121000000, orderCount: 108, heightPct: 72 },
      { label: "T3", revenueVnd: 134000000, orderCount: 119, heightPct: 80 },
      { label: "T4", revenueVnd: 128000000, orderCount: 112, heightPct: 76 },
      { label: "T5", revenueVnd: 142000000, orderCount: 126, heightPct: 85 },
      { label: "T6", revenueVnd: 155000000, orderCount: 138, heightPct: 92 },
      { label: "T7", revenueVnd: 168000000, orderCount: 149, heightPct: 100 },
    ],
  },
};

type Period = keyof typeof PERIODS;

function FinanceCard({
  icon,
  chip,
  label,
  value,
  small,
  chipTone = "plain",
}: {
  icon: string;
  chip: string;
  label: string;
  value: string;
  small?: React.ReactNode;
  chipTone?: "positive" | "plain";
}) {
  return (
    <article className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={icon} />
          </svg>
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipTone === "positive" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {chip}
        </span>
      </div>
      <span className="mt-4 block text-xs font-medium text-muted">{label}</span>
      <strong className="mt-1 block text-xl font-extrabold tabular-nums tracking-tight text-ink">{value}</strong>
      {small && <small className="mt-1 block text-xs text-muted">{small}</small>}
    </article>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("day");
  const data = PERIODS[period];

  return (
    <div>
      <PageHeader
        title="Tổng quan kinh doanh"
        description="Doanh thu, giá vốn, lợi nhuận, đơn hàng và tồn kho."
      >
        <Link href="/orders?needsAction=1" className="btn-ghost">Đơn cần xử lý</Link>
      </PageHeader>

      {/* Finance cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceCard
          icon="M3 14l5-5 3 3 5-6M13 6h4v4"
          chip="Bán ra"
          chipTone="positive"
          label="Doanh thu / tiền bán ra"
          value={formatVnd(stats.salesAmount)}
          small={<>Hôm nay <b className="text-ink">{formatVnd(stats.todayRevenue)}</b> · {stats.revenueOrders} đơn hợp lệ</>}
        />
        <FinanceCard
          icon="M10 3v10M6 9l4 4 4-4M3 16h14"
          chip="Nhập hàng"
          label="Tổng tiền nhập hàng"
          value={formatVnd(stats.purchaseCost)}
          small={<>Giá trị vốn tồn kho <b className="text-ink">{formatVnd(stats.inventoryValue)}</b></>}
        />
        <FinanceCard
          icon="M10 2L2 6v8l8 4 8-4V6l-8-4ZM2 6l8 4 8-4M10 10v8"
          chip="COGS"
          label="Giá vốn hàng đã bán"
          value={formatVnd(stats.costOfGoods)}
          small="Chỉ tính hàng & dịch vụ đã ghi nhận doanh thu"
        />
        <FinanceCard
          icon="M3 16l4-6 3 4 3-7 4 9"
          chip={`${stats.profitMargin}%`}
          chipTone="positive"
          label="Lợi nhuận gộp"
          value={formatVnd(stats.grossProfit)}
          small="Doanh thu trừ giá vốn đã bán"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue chart */}
        <Panel
          className="xl:col-span-2"
          title="Tổng doanh thu"
          subtitle={`${data.label} · ${data.range}`}
          right={
            <div className="flex rounded-lg border border-line bg-slate-50 p-0.5">
              {(Object.keys(PERIODS) as Period[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    period === key ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {PERIODS[key].label.replace("Theo ", "")}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
            <div>
              <span className="text-xs text-muted">Tổng doanh thu trong kỳ</span>
              <strong className="block text-2xl font-extrabold tabular-nums text-ink">
                {formatVnd(data.summary.totalRevenueVnd)}
              </strong>
            </div>
            <div>
              <span className="text-xs text-muted">Doanh thu hôm nay</span>
              <strong className="block text-2xl font-extrabold tabular-nums text-brand-700">
                {formatVnd(stats.todayRevenue)}
              </strong>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Tổng kỳ", value: formatVnd(data.summary.totalRevenueVnd) },
              { label: "Số đơn", value: data.summary.totalOrders },
              { label: "Trung bình / đơn", value: formatVnd(data.summary.averageOrderVnd) },
              { label: "Cao nhất", value: formatVnd(data.summary.peakRevenueVnd), sub: data.summary.peakLabel },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-white p-3">
                <span className="block text-xs text-muted">{item.label}</span>
                <strong className="mt-0.5 block text-sm font-bold tabular-nums text-ink">{item.value}</strong>
                {item.sub && <small className="text-xs text-muted">{item.sub}</small>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs text-muted">
              <i className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-brand-400 to-brand-700" />
              Doanh thu theo mốc thời gian
            </span>
            <strong className="text-xs font-bold text-ink">{data.summary.totalOrders} đơn</strong>
          </div>

          <div className="mt-3 flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label={`Biểu đồ cột doanh thu ${data.label.toLowerCase()}`}>
            {data.points.map((point) => (
              <div key={point.label} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="relative flex h-full items-end rounded-t-md transition-all duration-300">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      point.revenueVnd > 0
                        ? "bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-700 group-hover:to-brand-500"
                        : "bg-slate-200"
                    }`}
                    style={{ height: `${point.heightPct}%` }}
                  >
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs opacity-0 shadow-lg transition group-hover:opacity-100">
                      <strong className="block font-bold text-ink">{formatVnd(point.revenueVnd)}</strong>
                      <span className="text-muted">{point.orderCount} đơn</span>
                    </div>
                  </div>
                </div>
                <span className="mt-2 text-center text-[11px] text-muted">{point.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* System health & Alerts sidebar */}
        <div className="space-y-6">
          <Panel title="Tình trạng hệ thống">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Đang chờ", value: health.pending, href: "/orders?status=pending", warn: health.pending > 0 },
                { label: "Cần xử lý", value: health.needsReviewOrders, href: "/orders?needsAction=1", danger: health.needsReviewOrders > 0 },
                { label: "Lệch tiền", value: health.paymentNeedsReview, href: "/payments?needsReview=1", danger: health.paymentNeedsReview > 0 },
              ].map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="rounded-xl border border-line bg-surface-soft p-3 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="block text-xs text-muted">{stat.label}</span>
                  <strong className={`block text-xl font-extrabold tabular-nums ${stat.danger ? "text-red-600" : stat.warn ? "text-amber-600" : "text-ink"}`}>
                    {stat.value}
                  </strong>
                </Link>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4">
              {[
                { label: "Khách hàng", value: health.users },
                { label: "Tổng đơn", value: health.orders },
              ].map((stat) => (
                <div key={stat.label} className="flex items-baseline justify-between">
                  <dt className="text-xs text-muted">{stat.label}</dt>
                  <dd className="text-sm font-bold tabular-nums text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Alerts */}
          <Panel title="Cảnh báo">
            <div className="space-y-2">
              {recentPaymentAlerts.map((payment) => (
                <Link key={payment.id} href={`/payments?q=${encodeURIComponent(payment.code)}`} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 transition hover:border-brand-300">
                  <span className="min-w-0">
                    <strong className="block text-sm text-ink">{payment.code}</strong>
                    <small className="text-xs text-muted">{formatVnd(payment.amountReceived)}</small>
                  </span>
                  <Badge tone={paymentTone(payment.status)}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                </Link>
              ))}
              {recentPaymentAlerts.length === 0 && (
                <EmptyState>Không có cảnh báo quan trọng.</EmptyState>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Recent orders full width */}
      <Panel
        title="Đơn mới nhất"
        right={<Link href="/orders" className="text-sm font-medium text-brand-700 hover:text-brand-800">Xem tất cả →</Link>}
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Mã đơn</th>
                <th className="th">Người tạo</th>
                <th className="th">Món ăn / Đồ uống</th>
                <th className="th">Thanh toán</th>
                <th className="th">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {recentOrders.map((order) => (
                <tr key={order.id} className={order.paymentStatus === "PAYMENT_REVIEW" || order.fulfillmentStatus === "QUEUED" ? "bg-red-50/50" : "hover:bg-surface-soft transition-colors"}>
                  <td className="td whitespace-nowrap">
                    <strong className="font-bold text-ink block">{order.code}</strong>
                    <span className="block text-xs font-medium text-slate-700">{formatDate(order.createdAt)}</span>
                    <span className="block text-[11px] text-slate-400">{formatTime(order.createdAt)}</span>
                  </td>
                  <td className="td">
                    <strong className="text-sm text-ink">@{order.user.username}</strong>
                    <small className="block text-xs text-muted">{order.user.firstName} {order.user.lastName}</small>
                  </td>
                  <td className="td">
                    <strong className="text-sm text-ink">{order.productName}</strong>
                    <small className="block text-xs text-muted">x{order.quantity} · {formatVnd(order.amountVnd)}</small>
                  </td>
                  <td className="td">
                    <strong className={`text-sm font-bold tabular-nums ${order.paidAmount >= order.amountVnd ? "text-emerald-600" : order.paidAmount > 0 ? "text-red-600" : "text-ink"}`}>
                      {formatVnd(order.paidAmount)}
                    </strong>
                    <small className="block text-xs text-muted">{order.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản QR"}</small>
                  </td>
                  <td className="td whitespace-nowrap">
                    <Badge tone={orderPaymentTone(order.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={5}><EmptyState>Chưa có đơn hàng. Đơn mới từ bot sẽ xuất hiện tại đây.</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function paymentTone(status: string) {
  return ["underpaid", "unknown_code", "failed", "duplicate", "overpaid"].includes(status) ? "red" : "gray";
}
