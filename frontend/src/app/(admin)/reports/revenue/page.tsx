"use client";

import { useMemo, useState } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Stats } from "@/components/ui";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatVnd, formatDate } from "@/lib/format";
import { revenueDays } from "@/lib/data";
import { PERIOD_OPTIONS, periodRange, toDateInput, type Period } from "@/lib/period";

type MethodFilter = "all" | "cash" | "qr";

const METHOD_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "cash", label: "Tiền mặt" },
  { value: "qr", label: "Chuyển khoản QR" },
];

const METHOD_LABEL: Record<MethodFilter, string> = {
  all: "Tổng doanh thu thuần",
  cash: "Doanh thu tiền mặt",
  qr: "Doanh thu chuyển khoản",
};

export default function RevenueReportPage() {
  const firstDate = revenueDays[0]?.date ?? "";
  const lastDate = revenueDays[revenueDays.length - 1]?.date ?? "";

  const [from, setFrom] = useState(firstDate);
  const [to, setTo] = useState(lastDate);
  const [method, setMethod] = useState<MethodFilter>("all");

  const filtered = useMemo(() => {
    return revenueDays.filter((d) => d.date >= from && d.date <= to);
  }, [from, to]);

  const rows = useMemo(
    () =>
      filtered.map((d) => ({
        ...d,
        netVnd: method === "all" ? d.cashVnd + d.qrVnd : method === "cash" ? d.cashVnd : d.qrVnd,
      })),
    [filtered, method]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          cashVnd: acc.cashVnd + r.cashVnd,
          qrVnd: acc.qrVnd + r.qrVnd,
          netVnd: acc.netVnd + r.netVnd,
          refundedVnd: acc.refundedVnd + r.refundedVnd,
          orderCount: acc.orderCount + r.orderCount,
        }),
        { cashVnd: 0, qrVnd: 0, netVnd: 0, refundedVnd: 0, orderCount: 0 }
      ),
    [rows]
  );

  const maxNet = Math.max(1, ...rows.map((r) => r.netVnd));

  return (
    <div>
      <PageHeader
        title="Báo cáo doanh thu"
        description="Doanh thu theo ngày theo phương thức thanh toán. Số tiền hoàn (REFUNDED) không tính vào doanh thu thuần."
      />

      {/* Bộ lọc */}
      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Từ ngày">
            <input className="input" type="date" value={from} min={firstDate} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input className="input" type="date" value={to} min={from} max={lastDate} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Phương thức" className="sm:col-span-2">
            <div className="flex rounded-lg border border-line bg-slate-50 p-0.5">
              {METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    method === opt.value ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Panel>

      {/* Thống kê */}
      <Stats
        items={[
          { label: METHOD_LABEL[method], value: formatVnd(totals.netVnd), tone: "teal", sub: "Doanh thu sau khi trừ hoàn tiền" },
          { label: "Đã hoàn tiền (REFUNDED)", value: formatVnd(totals.refundedVnd), tone: "red", sub: "Không tính vào doanh thu thuần" },
          { label: "Số đơn hợp lệ", value: totals.orderCount, tone: "green", sub: "Đơn hoàn thành & đã thanh toán" },
          { label: "Trung bình / ngày", value: formatVnd(Math.round(totals.netVnd / Math.max(1, rows.length))), tone: "blue", sub: "Tính trên tổng số ngày trong kỳ" },
        ]}
      />

      {/* Biểu đồ */}
      <Panel
        className="mb-6"
        title="Doanh thu theo ngày"
        subtitle={`${formatDate(from)} → ${formatDate(to)} · ${rows.length} ngày`}
        right={
          <span className="flex items-center gap-2 text-xs text-muted">
            <i className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-brand-400 to-brand-700" />
            {METHOD_LABEL[method]}
          </span>
        }
      >
        {rows.length === 0 ? (
          <EmptyState>Không có dữ liệu trong khoảng ngày đã chọn.</EmptyState>
        ) : (
          <div className="flex h-48 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Biểu đồ doanh thu ${METHOD_LABEL[method].toLowerCase()}`}>
            {rows.map((r) => (
              <div key={r.date} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="relative flex h-full items-end rounded-t-md">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      r.netVnd > 0
                        ? "bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-700 group-hover:to-brand-500"
                        : "bg-slate-200"
                    }`}
                    style={{ height: `${Math.max(2, Math.round((r.netVnd / maxNet) * 100))}%` }}
                  >
                    <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs opacity-0 shadow-lg transition group-hover:opacity-100">
                      <strong className="block font-bold text-ink">{formatVnd(r.netVnd)}</strong>
                      <span className="text-muted">{r.orderCount} đơn · hoàn {formatVnd(r.refundedVnd)}</span>
                    </div>
                  </div>
                </div>
                <span className="mt-2 text-center text-[10px] text-muted">{formatDate(r.date).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Bảng theo ngày */}
      <Panel
        title="Chi tiết theo ngày"
        right={<span className="text-sm text-muted"><strong className="text-ink">{rows.length}</strong> ngày</span>}
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Ngày</th>
                <th className="th text-right">Tiền mặt (CASH)</th>
                <th className="th text-right">Chuyển khoản (QR)</th>
                <th className="th text-right">Đã hoàn (REFUNDED)</th>
                <th className="th text-right">Tổng thuần</th>
                <th className="th text-right">Số đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>Không có dữ liệu trong khoảng ngày đã chọn.</EmptyState>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.date} className="hover:bg-surface-soft transition-colors">
                  <td className="td font-semibold text-ink whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="td text-right tabular-nums text-slate-700">{formatVnd(r.cashVnd)}</td>
                  <td className="td text-right tabular-nums text-slate-700">{formatVnd(r.qrVnd)}</td>
                  <td className="td text-right tabular-nums text-red-600">
                    {r.refundedVnd > 0 ? `−${formatVnd(r.refundedVnd)}` : "—"}
                  </td>
                  <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(r.netVnd)}</td>
                  <td className="td text-right tabular-nums text-slate-700">{r.orderCount}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-slate-50/60">
                  <td className="td text-sm font-bold text-ink">Tổng cộng</td>
                  <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(totals.cashVnd)}</td>
                  <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(totals.qrVnd)}</td>
                  <td className="td text-right font-bold tabular-nums text-red-600">{formatVnd(totals.refundedVnd)}</td>
                  <td className="td text-right font-extrabold tabular-nums text-brand-700">{formatVnd(totals.netVnd)}</td>
                  <td className="td text-right font-bold tabular-nums text-ink">{totals.orderCount}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {method !== "all" && (
          <p className="mt-3 text-xs text-muted">
            <Badge tone="teal">Đang lọc theo {METHOD_OPTIONS.find((o) => o.value === method)?.label}</Badge>{" "}
            — cột “Tổng thuần” chỉ tính phương thức đang chọn.
          </p>
        )}
      </Panel>
    </div>
  );
}
