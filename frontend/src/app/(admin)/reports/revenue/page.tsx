"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader, Panel, EmptyState, Field, PageLoading } from "@/components/ui";
import { formatVnd, formatDate } from "@/lib/format";
import { getRevenueReport, type ApiRevenueReport, type ApiDailyRevenueItem } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toDateInput } from "@/lib/period";

import { useToast } from "@/components/Toast";

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toDateInput(d);
}

type MethodFilter = "ALL" | "CASH" | "QR";

export default function RevenueReportPage() {
  const toast = useToast();
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(thirtyDaysAgo());
  const [to, setTo] = useState(today);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");

  const handleExportExcel = () => {
    if (!byDate || byDate.length === 0) {
      toast.push("Không có dữ liệu doanh thu để xuất file", "error");
      return;
    }

    const headers = ["Ngày", "Tiền mặt (CASH)", "Chuyển khoản (QR)", "Đã hoàn (REFUNDED)", "Doanh thu thuần", "Số đơn"];
    const rows = byDate.map((item) => [
      item.date,
      item.cashAmount,
      item.qrAmount,
      item.refundedAmount,
      item.netRevenue,
      item.orderCount,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_doanh_thu_${from}_den_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.push("Đã xuất báo cáo doanh thu ra file Excel (.csv)", "success");
  };

  const load = useCallback(async () => {
    const payload = await getRevenueReport(from, to);
    return payload.data;
  }, [from, to]);

  const { data: report, loading, error, reload } = useApiData<ApiRevenueReport | null>(load, null);

  const summary = report?.summary;
  const byMethod = report?.byMethod;
  const byDate = report?.byDate ?? [];

  const totals = useMemo(() => {
    if (!summary) return null;
    const toNumber = (value?: string) => Number(value) || 0;

    const cashVnd = toNumber(byMethod?.CASH.amount ?? "0");
    const qrVnd = toNumber(byMethod?.QR.amount ?? "0");
    const refundedVnd = toNumber(summary.refundedAmount);
    const grossVnd = toNumber(summary.grossRevenue);
    const netVnd = toNumber(summary.netRevenue);
    const paidOrderCount = summary.paidOrderCount;
    const totalDays = summary.totalDays || (byDate.length || 1);
    const avgDailyNetRevenue = summary.avgDailyNetRevenue
      ? toNumber(summary.avgDailyNetRevenue)
      : Math.round(netVnd / totalDays);

    return {
      grossVnd,
      netVnd,
      refundedVnd,
      paidOrderCount,
      refundCount: summary.refundCount,
      cashVnd,
      qrVnd,
      totalDays,
      avgDailyNetRevenue,
    };
  }, [summary, byMethod, byDate]);

  // Filtered daily items according to method filter
  const filteredDailyItems = useMemo(() => {
    return byDate.map((item) => {
      const cash = Number(item.cashAmount) || 0;
      const qr = Number(item.qrAmount) || 0;
      const refunded = Number(item.refundedAmount) || 0;
      const gross = Number(item.grossRevenue) || cash + qr;
      const net = Number(item.netRevenue) || gross - refunded;

      let displayAmount = net;
      if (methodFilter === "CASH") displayAmount = cash;
      if (methodFilter === "QR") displayAmount = qr;

      return {
        ...item,
        cashVal: cash,
        qrVal: qr,
        refundedVal: refunded,
        grossVal: gross,
        netVal: net,
        displayAmount,
      };
    }).filter(item => item.orderCount > 0 || item.refundCount > 0);
  }, [byDate, methodFilter]);

  const maxDailyAmount = useMemo(() => {
    if (!filteredDailyItems.length) return 1;
    return Math.max(...filteredDailyItems.map((d) => d.displayAmount), 1);
  }, [filteredDailyItems]);

  if (loading) {
    return <PageLoading label="Đang đối soát & tổng hợp doanh thu..." subText="Đang tính toán doanh thu thuần, hoàn tiền và sản lượng theo ngày..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo doanh thu"
        description="Doanh thu theo ngày theo phương thức thanh toán. Số tiền hoàn (REFUNDED) không tính vào doanh thu thuần."
      >
        <button
          type="button"
          onClick={handleExportExcel}
          className="btn text-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Xuất Excel
        </button>
      </PageHeader>

      {/* Bộ lọc */}
      <Panel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
          <div className="md:col-span-3">
            <Field label="Từ ngày">
              <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Đến ngày">
              <input className="input" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-6">
            <Field label="Phương thức">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                {(
                  [
                    { id: "ALL", label: "Tất cả" },
                    { id: "CASH", label: "Tiền mặt" },
                    { id: "QR", label: "Chuyển khoản QR" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethodFilter(m.id)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      methodFilter === m.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Panel>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!report || !totals ? (
        <Panel>
          <EmptyState>Chọn khoảng thời gian và nhấn “Xem báo cáo” để tải dữ liệu doanh thu.</EmptyState>
        </Panel>
      ) : (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Tổng doanh thu thuần</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-emerald-600">
                {formatVnd(totals.netVnd)}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">Doanh thu sau khi trừ hoàn tiền</span>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Đã hoàn tiền (REFUNDED)</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-red-500">
                {formatVnd(totals.refundedVnd)}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">Không tính vào doanh thu thuần</span>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Số đơn hợp lệ</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-slate-800">
                {totals.paidOrderCount}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">Đơn hoàn thành &amp; đã thanh toán</span>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Trung bình / ngày</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-blue-600">
                {formatVnd(totals.avgDailyNetRevenue)}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">Tính trên tổng số ngày trong kỳ</span>
            </div>
          </div>

          {/* Biểu đồ doanh thu theo ngày */}
          <Panel
            title="Doanh thu theo ngày"
            subtitle={`${formatDate(report.range.from)} → ${formatDate(report.range.to)} · ${totals.totalDays} ngày`}
            right={
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span>
                  {methodFilter === "ALL"
                    ? "Tổng doanh thu thuần"
                    : methodFilter === "CASH"
                    ? "Tiền mặt (CASH)"
                    : "Chuyển khoản QR"}
                </span>
              </div>
            }
          >
            {filteredDailyItems.length === 0 ? (
              <EmptyState>Không có dữ liệu trong khoảng thời gian này.</EmptyState>
            ) : (
              <div className="relative pt-6 pb-2">
                {/* Bars Container */}
                <div className="flex h-48 items-end gap-1.5 sm:gap-3 overflow-x-auto pb-6 px-1">
                  {filteredDailyItems.map((item) => {
                    const pct = item.displayAmount > 0 ? Math.max(2, Math.round((item.displayAmount / maxDailyAmount) * 100)) : 0;
                    const dateParts = item.date.split("-");
                    const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : item.date;

                    return (
                      <div
                        key={item.date}
                        className="group flex flex-1 min-w-[24px] flex-col items-center h-full justify-end"
                      >
                        <div className="w-full max-w-[40px] flex-1 flex items-end">
                          {pct > 0 && (
                            <div
                              className="w-full rounded-t-lg transition-all duration-200 bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-400"
                              style={{ height: `${pct}%` }}
                            />
                          )}
                        </div>
                        <span className="mt-2 text-[10px] sm:text-xs font-medium text-slate-400 group-hover:text-slate-700 transition-colors truncate">
                          {shortDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          {/* Chi tiết theo ngày */}
          <Panel
            title="Chi tiết theo ngày"
            right={<span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{filteredDailyItems.length} ngày có giao dịch</span>}
          >
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="th text-left">NGÀY</th>
                    <th className="th text-right">TIỀN MẶT (CASH)</th>
                    <th className="th text-right">CHUYỂN KHOẢN (QR)</th>
                    <th className="th text-right">ĐÃ HOÀN (REFUNDED)</th>
                    <th className="th text-right">TỔNG THUẦN</th>
                    <th className="th text-right">SỐ ĐƠN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {filteredDailyItems.map((item) => (
                    <tr key={item.date} className="hover:bg-slate-50/80 transition-colors">
                      <td className="td font-medium text-slate-800">{formatDate(item.date)}</td>
                      <td className="td text-right tabular-nums text-slate-700">{formatVnd(item.cashVal)}</td>
                      <td className="td text-right tabular-nums text-slate-700">{formatVnd(item.qrVal)}</td>
                      <td className="td text-right tabular-nums">
                        {item.refundedVal > 0 ? (
                          <span className="text-red-500 font-semibold">−{formatVnd(item.refundedVal)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="td text-right font-extrabold tabular-nums text-slate-900">
                        {formatVnd(item.netVal)}
                      </td>
                      <td className="td text-right tabular-nums text-slate-600 font-medium">{item.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

