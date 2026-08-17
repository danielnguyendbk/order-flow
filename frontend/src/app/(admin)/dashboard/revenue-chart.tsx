"use client";

import { useEffect, useMemo, useState } from "react";
import { formatVnd } from "@/lib/format";
import {
  getDashboard,
  type ApiDashboard,
  type ApiDashboardRevenuePoint,
  type DashboardRange,
} from "@/lib/api";
import { Spinner } from "@/components/ui";

const RANGE_OPTIONS: DashboardRange[] = [7, 30, 90];
const AXIS_STEPS = 4;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

interface ChartPoint {
  key: string;
  axisLabel: string;
  fullLabel: string;
  revenueVnd: number;
  orderCount: number;
}

function parseVietnamDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`);
}

function formatShortDate(date: string) {
  return parseVietnamDate(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: VIETNAM_TIME_ZONE,
  });
}

function formatLongDate(date: string) {
  return parseVietnamDate(date).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: VIETNAM_TIME_ZONE,
  });
}

function formatWeekday(date: string) {
  return parseVietnamDate(date)
    .toLocaleDateString("vi-VN", { weekday: "short", timeZone: VIETNAM_TIME_ZONE })
    .replace(",", "");
}

function asDailyPoint(point: ApiDashboardRevenuePoint, index: number, range: DashboardRange): ChartPoint {
  const showThirtyDayLabel = index === 0 || index % 5 === 0 || index === range - 1;
  return {
    key: point.date,
    axisLabel: range === 7 ? formatWeekday(point.date) : showThirtyDayLabel ? formatShortDate(point.date) : "",
    fullLabel: formatLongDate(point.date),
    revenueVnd: Number(point.revenue),
    orderCount: point.orderCount,
  };
}

function toChartPoints(series: ApiDashboardRevenuePoint[], range: DashboardRange): ChartPoint[] {
  if (range !== 90) {
    return series.map((point, index) => asDailyPoint(point, index, range));
  }

  const groups: ChartPoint[] = [];
  for (let index = 0; index < series.length; index += 7) {
    const week = series.slice(index, index + 7);
    const first = week[0];
    const last = week.at(-1);
    if (!first || !last) continue;
    const from = formatShortDate(first.date);
    const to = formatShortDate(last.date);
    groups.push({
      key: `${first.date}-${last.date}`,
      axisLabel: from,
      fullLabel: from === to ? formatLongDate(first.date) : `${from} – ${to}`,
      revenueVnd: week.reduce((sum, point) => sum + Number(point.revenue), 0),
      orderCount: week.reduce((sum, point) => sum + point.orderCount, 0),
    });
  }
  return groups;
}

function niceAxisMaximum(value: number) {
  if (value <= 0) return 1;
  const roughStep = value / AXIS_STEPS;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude * AXIS_STEPS;
}

function formatAxisVnd(value: number) {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value / 1_000)}k`;
  return new Intl.NumberFormat("vi-VN").format(value);
}

function rangeDescription(range: DashboardRange) {
  return range === 90 ? "90 ngày gần nhất, tổng hợp theo từng 7 ngày" : `${range} ngày gần nhất`;
}

export default function RevenueChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [range, setRange] = useState<DashboardRange>(7);
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const task = Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      return getDashboard(range, controller.signal);
    });

    void task
      .then((response) => {
        if (!response) return;
        setDashboard(response.data);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu biểu đồ.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [range, refreshKey, retryKey]);

  const points = useMemo(
    () => toChartPoints(dashboard?.revenueSeries ?? [], range),
    [dashboard?.revenueSeries, range],
  );
  const totalRevenue = points.reduce((sum, point) => sum + point.revenueVnd, 0);
  const totalOrders = points.reduce((sum, point) => sum + point.orderCount, 0);
  const peak = points.reduce<ChartPoint | null>(
    (best, point) => (!best || point.revenueVnd > best.revenueVnd ? point : best),
    null,
  );
  const axisMaximum = niceAxisMaximum(Math.max(0, ...points.map((point) => point.revenueVnd)));
  const ticks = Array.from({ length: AXIS_STEPS + 1 }, (_, index) => (axisMaximum / AXIS_STEPS) * index);
  const hasRevenue = points.some((point) => point.revenueVnd > 0);
  const rangeMatchesData = dashboard?.range.days === range;

  return (
    <section className="card flex h-full min-h-[430px] flex-col p-4 sm:p-6">
      <figure className="flex h-full flex-col" aria-labelledby="revenue-chart-title" aria-describedby="revenue-chart-summary">
        <figcaption className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="revenue-chart-title" className="text-[15px] font-bold text-ink">Doanh thu theo thời gian</h2>
            <p id="revenue-chart-summary" className="mt-0.5 text-sm text-muted">
              {rangeDescription(range)} · tổng <strong className="font-semibold text-ink">{formatVnd(totalRevenue)}</strong>
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1" aria-label="Chọn khoảng thời gian">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700/40 ${
                  range === option ? "bg-white text-forest-800 shadow-sm" : "text-muted hover:text-ink"
                }`}
                onClick={() => setRange(option)}
              >
                {option} ngày
              </button>
            ))}
          </div>
        </figcaption>

        <div className="mt-4 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
          <span><strong className="font-bold tabular-nums text-ink">{totalOrders}</strong> đơn đã thanh toán</span>
          {peak && hasRevenue && (
            <span>Cao nhất: <strong className="font-semibold text-ink">{peak.fullLabel}</strong> · {formatVnd(peak.revenueVnd)}</span>
          )}
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-forest-700">
              <Spinner size="sm" /> Đang cập nhật…
            </span>
          )}
        </div>

        {error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span>{error}</span>
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setRetryKey((value) => value + 1)}>
              Thử lại
            </button>
          </div>
        )}

        {!error && !loading && points.length === 0 && (
          <div className="flex min-h-[260px] flex-1 items-center justify-center text-center text-sm text-muted">
            Chưa có dữ liệu doanh thu trong khoảng thời gian này.
          </div>
        )}

        {points.length > 0 && (
          <>
            <div className={`mt-4 grid min-h-[260px] flex-1 grid-cols-[3rem_minmax(0,1fr)] gap-x-3 transition-opacity ${loading || !rangeMatchesData ? "opacity-60" : "opacity-100"}`}>
              <div className="relative h-[230px]" aria-hidden="true">
                {[...ticks].reverse().map((tick, index) => (
                  <span
                    key={tick}
                    className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted"
                    style={{ top: `${(index / AXIS_STEPS) * 100}%` }}
                  >
                    {formatAxisVnd(tick)}
                  </span>
                ))}
              </div>

              <div className="min-w-0">
                <div
                  className="relative flex h-[230px] items-end border-b border-slate-300"
                  role="img"
                  aria-label={`Biểu đồ cột ${rangeDescription(range)}, tổng doanh thu ${formatVnd(totalRevenue)}, ${totalOrders} đơn đã thanh toán.`}
                >
                  {[...ticks].reverse().map((tick, index) => (
                    <span
                      key={tick}
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200"
                      style={{ top: `${(index / AXIS_STEPS) * 100}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  <div className={`absolute inset-0 flex items-end ${range === 30 ? "gap-0.5 sm:gap-1" : "gap-1.5 sm:gap-2"}`} aria-hidden="true">
                    {points.map((point, index) => {
                      const height = point.revenueVnd <= 0 ? 0 : Math.max(1.5, (point.revenueVnd / axisMaximum) * 100);
                      const tooltipPosition = index === 0 ? "left-0" : index === points.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
                      return (
                        <div key={point.key} className="group relative flex h-full min-w-0 flex-1 items-end">
                          <div className={`pointer-events-none absolute top-2 z-20 hidden min-w-max rounded-lg border border-line bg-white px-2.5 py-2 text-xs shadow-xl group-hover:block group-active:block ${tooltipPosition}`}>
                            <strong className="block font-semibold text-ink">{point.fullLabel}</strong>
                            <span className="mt-0.5 block text-muted">{formatVnd(point.revenueVnd)} · {point.orderCount} đơn</span>
                          </div>
                          <span
                            className={`block w-full rounded-t-sm transition-colors ${index === points.length - 1 ? "bg-forest-800" : "bg-brand-500 group-hover:bg-brand-600"}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={`mt-2 flex ${range === 30 ? "gap-0.5 sm:gap-1" : "gap-1.5 sm:gap-2"}`} aria-hidden="true">
                  {points.map((point) => (
                    <span key={point.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted sm:text-[11px]" title={point.fullLabel}>
                      {point.axisLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!hasRevenue && !loading && (
              <p className="mt-2 text-center text-sm text-muted">Chưa phát sinh doanh thu đã thanh toán trong khoảng này.</p>
            )}

            <details className="mt-4 border-t border-line-soft pt-3">
              <summary className="w-fit cursor-pointer rounded-md text-xs font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30">
                Xem dữ liệu chi tiết
              </summary>
              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-line">
                <table className="w-full min-w-[430px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Ngày / khoảng ngày</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Doanh thu</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Số đơn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {points.map((point) => (
                      <tr key={point.key}>
                        <th scope="row" className="px-3 py-2 font-medium text-ink">{point.fullLabel}</th>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">{formatVnd(point.revenueVnd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">{point.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </figure>
    </section>
  );
}
