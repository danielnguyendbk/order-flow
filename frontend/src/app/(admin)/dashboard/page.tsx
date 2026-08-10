"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge, orderPaymentTone, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatTime } from "@/lib/format";
import {
  dashboardStats as stats,
  dashboardHealth as health,
  revenueChartPoints,
  recentOrders,
  trafficSources,
  serverUptime,
  ORDER_PAYMENT_STATUS_LABEL,
  type Order,
} from "@/lib/data";

const PERIODS = {
  week: {
    label: "Tuần",
    range: "7 ngày qua",
    summary: { totalRevenueVnd: 144000000, totalOrders: 142, averageOrderVnd: 1088028 },
    points: revenueChartPoints,
  },
  month: {
    label: "Tháng",
    range: "30 ngày qua",
    summary: { totalRevenueVnd: 476000000, totalOrders: 408, averageOrderVnd: 1166666 },
    points: [
      { label: "T1", revenueVnd: 52000000, orderCount: 45, heightPct: 72 },
      { label: "T2", revenueVnd: 58000000, orderCount: 51, heightPct: 81 },
      { label: "T3", revenueVnd: 49000000, orderCount: 42, heightPct: 68 },
      { label: "T4", revenueVnd: 61000000, orderCount: 55, heightPct: 85 },
      { label: "T5", revenueVnd: 66000000, orderCount: 58, heightPct: 92 },
      { label: "T6", revenueVnd: 72000000, orderCount: 61, heightPct: 100 },
    ],
  },
  day: {
    label: "Ngày",
    range: "Hôm nay",
    summary: { totalRevenueVnd: 12500000, totalOrders: 12, averageOrderVnd: 1041666 },
    points: [
      { label: "8h", revenueVnd: 900000, orderCount: 1, heightPct: 22 },
      { label: "10h", revenueVnd: 2100000, orderCount: 2, heightPct: 52 },
      { label: "12h", revenueVnd: 3300000, orderCount: 3, heightPct: 82 },
      { label: "14h", revenueVnd: 2400000, orderCount: 2, heightPct: 60 },
      { label: "16h", revenueVnd: 3800000, orderCount: 4, heightPct: 94 },
    ],
  },
} as const;

type Period = keyof typeof PERIODS;

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

/* ── KPI ── */
const KPIS = [
  {
    label: "Tổng doanh thu",
    value: formatVnd(stats.salesAmount),
    trend: "+12,5%",
    up: true,
    sub: "so với tuần trước",
    dark: true,
  },
  { label: "Tổng đơn hàng", value: String(stats.revenueOrders), trend: "+8,2%", up: true, sub: "so với tuần trước" },
  { label: "Khách hàng mới", value: String(health.users), trend: "+3,1%", up: true, sub: "tuần này" },
  { label: "Tỷ lệ chuyển đổi", value: "4,8%", trend: "−0,4%", up: false, sub: "so với tuần trước" },
];

/* ── Biểu đồ cột doanh thu ── */
function RevenueChart() {
  const [period, setPeriod] = useState<Period>("week");
  const data = PERIODS[period];
  const maxIndex = data.points.reduce(
    (best, p, i) => (p.revenueVnd > data.points[best].revenueVnd ? i : best),
    0
  );

  return (
    <section className="card flex h-full flex-col justify-between p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Doanh thu theo tuần</h2>
          <p className="mt-0.5 text-sm text-muted">{data.range} · tổng {formatVnd(data.summary.totalRevenueVnd)}</p>
        </div>
        <div className="flex rounded-xl border border-line bg-slate-50 p-0.5">
          {(Object.keys(PERIODS) as Period[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                period === key ? "bg-forest-800 text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {PERIODS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex min-h-[260px] flex-1 items-end gap-1.5 pt-2 sm:gap-2" role="img" aria-label={`Biểu đồ cột doanh thu ${data.label.toLowerCase()}`}>
        {data.points.map((point, i) => {
          const highlight = i === maxIndex;
          return (
            <div key={point.label} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="relative flex h-full items-end">
                <div
                  className={`w-full rounded-full transition-all duration-300 ${
                    highlight
                      ? "bg-gradient-to-b from-forest-600 to-forest-900 shadow-lg shadow-forest-800/30"
                      : "bar-striped"
                  }`}
                  style={{ height: `${Math.max(4, point.heightPct)}%` }}
                >
                  <div className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-white px-3 py-1.5 text-xs opacity-0 shadow-xl transition group-hover:opacity-100">
                    <strong className="block font-bold text-ink">{formatVnd(point.revenueVnd)}</strong>
                    <span className="text-muted">{point.orderCount} đơn</span>
                  </div>
                </div>
              </div>
              <span className={`mt-2 text-center text-[11px] ${highlight ? "font-bold text-forest-800" : "text-muted"}`}>
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Đơn hàng gần đây ── */
const AVATAR_COLORS = [
  "from-brand-400 to-brand-600",
  "from-amber-400 to-orange-500",
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-red-500",
  "from-violet-400 to-purple-600",
];

function initialsOf(order: Order) {
  const fromName = `${order.user.firstName?.[0] ?? ""}${order.user.lastName?.[0] ?? ""}`.trim();
  return fromName || order.user.username[0]?.toUpperCase() || "?";
}

function RecentOrders() {
  return (
    <section className="card flex h-full flex-col justify-between p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Đơn hàng gần đây</h2>
          <p className="mt-0.5 text-sm text-muted">6 đơn mới nhất</p>
        </div>
        <Link href="/orders" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
          Xem tất cả →
        </Link>
      </div>
      <ul className="divide-y divide-line-soft">
        {recentOrders.map((order, i) => (
          <li key={order.id} className="flex items-center gap-3 py-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
            >
              {initialsOf(order)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{order.productName}</p>
              <p className="text-xs text-muted">
                @{order.user.username} · {formatTime(order.createdAt)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-ink">{formatVnd(order.amountVnd)}</p>
              <Badge tone={orderPaymentTone(order.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Donut nguồn truy cập ── */
function DonutChart() {
  const R = 50;
  const C = 2 * Math.PI * R;
  const top = trafficSources[0];

  // Tính sẵn độ dài + vị trí bắt đầu của từng phân đoạn (bất biến, không mutate khi render)
  const segments = trafficSources.reduce<
    { label: string; percent: number; color: string; len: number; offset: number }[]
  >((acc, s) => {
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.len : 0;
    acc.push({ ...s, len: (s.percent / 100) * C, offset });
    return acc;
  }, []);

  return (
    <section className="card flex h-full flex-col justify-between p-6">
      <h2 className="text-[15px] font-bold text-ink">Nguồn truy cập</h2>
      <p className="mt-0.5 text-sm text-muted">Phân bổ lượt truy cập website</p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
        <div className="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#eef1f0" strokeWidth={13} />
            {segments.map((s) => (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={13}
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={-s.offset}
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl font-extrabold tracking-tight text-ink">{top.percent}%</strong>
            <span className="text-[11px] font-medium text-muted">{top.label.toLowerCase()}</span>
          </div>
        </div>

        <ul className="w-full max-w-[220px] space-y-2.5">
          {trafficSources.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-slate-600">{s.label}</span>
              <strong className="tabular-nums text-ink">{s.percent}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Server uptime ── */
function UptimeCard() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const since = new Date(serverUptime.sinceIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const d = Math.floor(elapsed / 86400);
  const h = Math.floor((elapsed % 86400) / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <section className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 to-forest-800 p-6 text-white shadow-xl shadow-forest-900/25">
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-300" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="6" width="16" height="10" rx="2" />
              <path d="M6 10h.01M9 10h.01M12 10h.01M6 13h.01M9 13h.01" />
            </svg>
          </span>
          <div>
            <h2 className="text-[15px] font-bold">Thời gian hoạt động</h2>
            <p className="text-xs text-brand-200/80">{serverUptime.label}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline gap-2">
            <strong className="text-5xl font-extrabold tracking-tight">{String(serverUptime.percent).replace(".", ",")}%</strong>
            <span className="text-sm font-semibold text-brand-300">uptime</span>
          </div>
          <p className="mt-3 font-mono text-lg font-bold tabular-nums tracking-widest text-brand-100">
            {pad(d)}<span className="text-brand-400">d</span> : {pad(h)}
            <span className="text-brand-400">h</span> : {pad(m)}
            <span className="text-brand-400">m</span> : {pad(s)}
            <span className="text-brand-400">s</span>
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-brand-200/85">
            {serverUptime.events.map((event) => (
              <li key={event.label} className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    event.tone === "green" ? "bg-emerald-400" : "bg-brand-300/60"
                  }`}
                />
                {event.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sóng xanh trang trí */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-90" aria-hidden>
        <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%]" style={{ animation: "waveShift 9s linear infinite" }}>
          <path d="M0 70 Q150 30 300 70 T600 70 T900 70 T1200 70 V120 H0 Z" fill="rgba(74,222,128,0.16)" />
        </svg>
        <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-[70%] w-[200%]" style={{ animation: "waveShift 6s linear infinite" }}>
          <path d="M0 70 Q150 30 300 70 T600 70 T900 70 T1200 70 V120 H0 Z" fill="rgba(134,239,172,0.22)" />
        </svg>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const toast = useToast();

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      {/* Title */}
      <PageHeader title="Tổng quan" description="Lên kế hoạch, ưu tiên và quản lý hoạt động kinh doanh.">
        <button
          type="button"
          className="btn"
          onClick={() => toast.push("Đã xuất file Excel báo cáo tổng quan thành công.", "success")}
        >
          Xuất Excel
        </button>
      </PageHeader>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) =>
          kpi.dark ? (
            <article
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-700 to-forest-950 p-5 text-white shadow-lg shadow-forest-900/30 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand-400/15 blur-2xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-brand-300/10 blur-xl" aria-hidden />
              <div className="relative flex items-start justify-between">
                <span className="text-xs font-medium text-brand-200/80">{kpi.label}</span>
                <Trend up>{kpi.trend}</Trend>
              </div>
              <strong className="relative mt-3 block text-[28px] font-extrabold tabular-nums tracking-tight">{kpi.value}</strong>
              <p className="relative mt-1 text-xs text-brand-200/60">{kpi.sub}</p>
            </article>
          ) : (
            <article
              key={kpi.label}
              className="card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,61,36,0.1)]"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted">{kpi.label}</span>
                <Trend up={kpi.up}>{kpi.trend}</Trend>
              </div>
              <strong className="mt-3 block text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{kpi.value}</strong>
              <p className="mt-1 text-xs text-muted">{kpi.sub}</p>
            </article>
          )
        )}
      </div>

      {/* Row 2: chart + recent orders */}
      <div className="mb-6 grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        <div className="flex flex-col xl:col-span-2">
          <RevenueChart />
        </div>
        <RecentOrders />
      </div>

      {/* Row 3: donut + uptime */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        <div className="flex flex-col xl:col-span-2">
          <DonutChart />
        </div>
        <UptimeCard />
      </div>
    </div>
  );
}
