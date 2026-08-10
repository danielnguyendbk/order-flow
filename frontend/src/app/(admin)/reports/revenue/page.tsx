"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader, Panel, EmptyState, Field, Stats } from "@/components/ui";
import { formatVnd, formatDate } from "@/lib/format";
import { getRevenueReport, type ApiRevenueReport } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toDateInput } from "@/lib/period";

function monthAgo(): string {
  const d = new Date();
  d.setDate(1);
  return toDateInput(d);
}

export default function RevenueReportPage() {
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today);

  const load = useCallback(async () => {
    const payload = await getRevenueReport(from, to);
    return payload.data;
  }, [from, to]);

  const { data: report, loading, error, reload } = useApiData<ApiRevenueReport | null>(load, null);

  const summary = report?.summary;
  const byMethod = report?.byMethod;

  const totals = useMemo(() => {
    if (!summary) return null;
    const toNumber = (value: string) => Number(value) || 0;
    return {
      grossVnd: toNumber(summary.grossRevenue),
      netVnd: toNumber(summary.netRevenue),
      refundedVnd: toNumber(summary.refundedAmount),
      paidOrderCount: summary.paidOrderCount,
      refundCount: summary.refundCount,
      cashVnd: toNumber(byMethod?.CASH.amount ?? "0"),
      qrVnd: toNumber(byMethod?.QR.amount ?? "0"),
      cashCount: byMethod?.CASH.count ?? 0,
      qrCount: byMethod?.QR.count ?? 0,
    };
  }, [summary, byMethod]);

  return (
    <div>
      <PageHeader
        title="Báo cáo doanh thu"
        description="Doanh thu theo phương thức thanh toán trong khoảng thời gian. Số tiền hoàn (REFUNDED) không tính vào doanh thu thuần."
      />

      {/* Bộ lọc */}
      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Từ ngày">
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input className="input" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end pb-2">
            <button type="button" className="btn" onClick={() => void reload()} disabled={loading}>
              {loading ? "Đang tải..." : "Xem báo cáo"}
            </button>
          </div>
        </div>
      </Panel>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!report || !totals ? (
        <Panel>
          <EmptyState>Chọn khoảng thời gian và nhấn “Xem báo cáo” để tải dữ liệu doanh thu.</EmptyState>
        </Panel>
      ) : (
        <>
          {/* Thống kê */}
          <Stats
            items={[
              { label: "Doanh thu thuần", value: formatVnd(totals.netVnd), tone: "teal", sub: "Tổng thu đã trừ hoàn tiền" },
              { label: "Tổng thu (gross)", value: formatVnd(totals.grossVnd), tone: "blue", sub: "Tổng tiền nhận từ khách" },
              { label: "Đã hoàn tiền", value: formatVnd(totals.refundedVnd), tone: "red", sub: `${totals.refundCount} giao dịch hoàn` },
              { label: "Đơn đã thanh toán", value: totals.paidOrderCount, tone: "green", sub: "Trong khoảng thời gian" },
            ]}
          />

          {/* Phân bổ theo phương thức */}
          <Panel
            className="mb-6"
            title="Doanh thu theo phương thức"
            subtitle={`${formatDate(report.range.from)} → ${formatDate(report.range.to)}`}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Tiền mặt (CASH)",
                  amount: totals.cashVnd,
                  count: totals.cashCount,
                  color: "from-amber-400 to-amber-600",
                },
                {
                  label: "Chuyển khoản (QR)",
                  amount: totals.qrVnd,
                  count: totals.qrCount,
                  color: "from-brand-400 to-brand-700",
                },
                {
                  label: "Đã hoàn (REFUNDED)",
                  amount: totals.refundedVnd,
                  count: totals.refundCount,
                  color: "from-red-400 to-red-600",
                },
              ].map((method) => (
                <div key={method.label} className="rounded-2xl border border-line bg-white p-5">
                  <span className="text-xs font-medium text-muted">{method.label}</span>
                  <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-ink">
                    {formatVnd(method.amount)}
                  </strong>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${method.color}`}
                      style={{
                        width: `${totals.grossVnd > 0 ? Math.max(2, Math.round((method.amount / totals.grossVnd) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <small className="mt-2 block text-xs text-muted">{method.count} giao dịch</small>
                </div>
              ))}
            </div>
          </Panel>

          {/* Bảng chi tiết */}
          <Panel
            title="Chi tiết tổng hợp"
            right={<span className="text-sm text-muted">Khoảng ngày {formatDate(report.range.from)} → {formatDate(report.range.to)}</span>}
          >
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Phương thức</th>
                    <th className="th text-right">Doanh thu</th>
                    <th className="th text-right">Số giao dịch</th>
                    <th className="th text-right">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  <tr className="hover:bg-surface-soft transition-colors">
                    <td className="td font-semibold text-ink">Tiền mặt (CASH)</td>
                    <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(totals.cashVnd)}</td>
                    <td className="td text-right tabular-nums text-slate-700">{totals.cashCount}</td>
                    <td className="td text-xs text-muted">Xác nhận thu tiền mặt</td>
                  </tr>
                  <tr className="hover:bg-surface-soft transition-colors">
                    <td className="td font-semibold text-ink">Chuyển khoản (QR)</td>
                    <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(totals.qrVnd)}</td>
                    <td className="td text-right tabular-nums text-slate-700">{totals.qrCount}</td>
                    <td className="td text-xs text-muted">Webhook SePay khớp đơn</td>
                  </tr>
                  <tr className="hover:bg-surface-soft transition-colors">
                    <td className="td font-semibold text-ink">Hoàn tiền (REFUNDED)</td>
                    <td className="td text-right font-bold tabular-nums text-red-600">−{formatVnd(totals.refundedVnd)}</td>
                    <td className="td text-right tabular-nums text-slate-700">{totals.refundCount}</td>
                    <td className="td text-xs text-muted">Không tính vào doanh thu thuần</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-slate-50/60">
                    <td className="td text-sm font-bold text-ink">Tổng thuần</td>
                    <td className="td text-right font-extrabold tabular-nums text-brand-700">{formatVnd(totals.netVnd)}</td>
                    <td className="td text-right tabular-nums text-slate-700">{totals.paidOrderCount} đơn</td>
                    <td className="td text-xs text-muted">Doanh thu sau khi trừ hoàn tiền</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
