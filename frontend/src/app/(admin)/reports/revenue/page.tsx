"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { PageHeader, Panel, EmptyState, Field, PageLoading } from "@/components/ui";
import { formatVnd, formatDate } from "@/lib/format";
import { getRevenueReport, type ApiRevenueReport } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toDateInput } from "@/lib/period";

import { useToast } from "@/components/Toast";

type MethodFilter = "ALL" | "CASH" | "QR";
type ViewMode = "day" | "week" | "month" | "year";

export default function RevenueReportPage() {
  const toast = useToast();
  
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [anchorDateStr, setAnchorDateStr] = useState(toDateInput(new Date()));
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [fromTime, setFromTime] = useState<string>("00:00");
  const [toTime, setToTime] = useState<string>("23:59");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("revenueFilters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (parsed.anchorDateStr) setAnchorDateStr(parsed.anchorDateStr);
        if (parsed.methodFilter) setMethodFilter(parsed.methodFilter);
        if (parsed.fromTime) setFromTime(parsed.fromTime);
        if (parsed.toTime) setToTime(parsed.toTime);
      } catch (e) {}
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    sessionStorage.setItem("revenueFilters", JSON.stringify({
      viewMode, anchorDateStr, methodFilter, fromTime, toTime
    }));
  }, [isInitialized, viewMode, anchorDateStr, methodFilter, fromTime, toTime]);

  const { from, to, groupBy } = useMemo(() => {
    const anchor = anchorDateStr ? new Date(anchorDateStr) : new Date();
    if (isNaN(anchor.getTime())) return { from: toDateInput(new Date()), to: toDateInput(new Date()), groupBy: "hour" };

    let fromDate = new Date(anchor);
    let toDate = new Date(anchor);
    let apiGroupBy: string = "day";

    if (viewMode === "day") {
      apiGroupBy = "hour";
      let actualFromTime = fromTime;
      let actualToTime = toTime;
      if (actualFromTime > actualToTime) {
        actualFromTime = toTime;
        actualToTime = fromTime;
      }
      return { 
        from: `${toDateInput(fromDate)}T${actualFromTime}:00+07:00`, 
        to: `${toDateInput(toDate)}T${actualToTime}:59+07:00`, 
        groupBy: apiGroupBy 
      };
    } else if (viewMode === "week") {
      apiGroupBy = "day";
      const day = anchor.getDay();
      const diff = anchor.getDate() - day + (day === 0 ? -6 : 1);
      fromDate.setDate(diff);
      toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 6);
    } else if (viewMode === "month") {
      apiGroupBy = "week";
      fromDate.setDate(1);
      toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0);
    } else if (viewMode === "year") {
      apiGroupBy = "month";
      fromDate = new Date(anchor.getFullYear(), 0, 1);
      toDate = new Date(anchor.getFullYear(), 11, 31);
    }

    return { from: toDateInput(fromDate), to: toDateInput(toDate), groupBy: apiGroupBy };
  }, [anchorDateStr, viewMode, fromTime, toTime]);

  const load = useCallback(async () => {
    const payload = await getRevenueReport(from, to, groupBy);
    return payload.data;
  }, [from, to, groupBy]);

  const { data: report, loading, error } = useApiData<ApiRevenueReport | null>(load, null);

  const handleExportExcel = () => {
    const byTime = report?.byTime;
    if (!byTime || byTime.length === 0) {
      toast.push("Không có dữ liệu doanh thu để xuất file", "error");
      return;
    }

    const headers = ["Thời gian", "Tiền mặt (CASH)", "Chuyển khoản (QR)", "Đã hoàn (REFUNDED)", "Doanh thu thuần", "Số đơn"];
    const rows = byTime.map((item) => [
      item.time,
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

  const summary = report?.summary;
  const byMethod = report?.byMethod;
  const byTime = report?.byTime;

  const totals = useMemo(() => {
    if (!summary) return null;
    const toNumber = (value?: string) => Number(value) || 0;

    const cashVnd = toNumber(byMethod?.CASH.amount ?? "0");
    const qrVnd = toNumber(byMethod?.QR.amount ?? "0");
    const refundedVnd = toNumber(summary.refundedAmount);
    const grossVnd = toNumber(summary.grossRevenue);
    const netVnd = toNumber(summary.netRevenue);
    const paidOrderCount = summary.paidOrderCount;
    const totalDays = summary.totalDays || (byTime?.length || 1);
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
  }, [summary, byMethod, byTime]);

  const filteredItems = useMemo(() => {
    if (!byTime) return [];
    return byTime.map((item) => {
      const cash = Number(item.cashAmount) || 0;
      const qr = Number(item.qrAmount) || 0;
      const refunded = Number(item.refundedAmount) || 0;
      const gross = Number(item.grossRevenue) || cash + qr;
      const net = Number(item.netRevenue) || gross - refunded;
      return {
        ...item,
        cashVal: cash,
        qrVal: qr,
        refundedVal: refunded,
        grossVal: gross,
        netVal: net,
      };
    });
  }, [byTime]);

  const maxDailyAmount = useMemo(() => {
    if (!filteredItems.length) return 1;
    let max = 1;
    filteredItems.forEach(d => {
       if (methodFilter === "ALL") max = Math.max(max, d.netVal, d.cashVal, d.qrVal);
       else if (methodFilter === "CASH") max = Math.max(max, d.cashVal);
       else if (methodFilter === "QR") max = Math.max(max, d.qrVal);
    });
    return Math.max(max, 1);
  }, [filteredItems, methodFilter]);

  function getPathFor(key: "netVal" | "cashVal" | "qrVal") {
    if (filteredItems.length === 0) return { pathD: "", polygonD: "" };
    const points = filteredItems.map((item, i) => {
      const x = filteredItems.length > 1 ? (i / (filteredItems.length - 1)) * 100 : 50;
      const val = item[key];
      const y = val > 0 ? 100 - (val / maxDailyAmount) * 90 : 100;
      return { x, y };
    });
    let pathD = `M -2,${points[0].y} L ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      pathD += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
    }
    pathD += ` L 102,${points[points.length - 1].y}`;
    const polygonD = points.length > 1 ? `${pathD} L 102,110 L -2,110 Z` : "";
    return { pathD, polygonD };
  }

  const netPath = getPathFor("netVal");
  const cashPath = getPathFor("cashVal");
  const qrPath = getPathFor("qrVal");

  if (loading && !report) {
    return <PageLoading label="Đang tổng hợp báo cáo doanh thu..." subText="Đang nhóm dữ liệu theo thời gian..." />;
  }

  const formatShortTime = (timeStr: string) => {
    if (timeStr.includes(" ")) {
      const [date, time] = timeStr.split(" ");
      return time.substring(0,5);
    }
    const p = timeStr.split("-");
    if (p.length === 2) return `Tháng ${p[1]}`;
    if (groupBy === "week") return `Tuần ${p[2]}/${p[1]}`;
    return `${p[2]}/${p[1]}`;
  };

  return (
    <div className="space-y-6 animate-[fadeUp_.35s_ease-out]">
      <PageHeader
        title="Báo cáo doanh thu"
        description="Phân tích doanh thu và sản lượng theo thời gian và phương thức thanh toán."
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
          <div className="md:col-span-4">
            <Field label="Chế độ xem">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                {(
                  [
                    { id: "day", label: "Ngày" },
                    { id: "week", label: "Tuần" },
                    { id: "month", label: "Tháng" },
                    { id: "year", label: "Năm" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setViewMode(g.id)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      viewMode === g.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Thời gian">
              {viewMode === "day" && (
                <div className="flex items-center gap-1.5">
                  <input className="input h-[34px] py-1 flex-1 min-w-[120px] text-sm" type="date" value={anchorDateStr} onChange={(e) => setAnchorDateStr(e.target.value)} />
                  <input className="input h-[34px] py-1 w-[85px] px-1 text-center text-sm" type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} title="Từ giờ" />
                  <span className="text-slate-400 font-medium">-</span>
                  <input className="input h-[34px] py-1 w-[85px] px-1 text-center text-sm" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} title="Đến giờ" />
                </div>
              )}
              {viewMode === "week" && (
                <input className="input" type="date" value={anchorDateStr} onChange={(e) => setAnchorDateStr(e.target.value)} title="Chọn 1 ngày bất kỳ trong tuần" />
              )}
              {viewMode === "month" && (
                <select 
                  className="input h-[34px] py-1" 
                  value={anchorDateStr.substring(0, 7)} 
                  onChange={(e) => setAnchorDateStr(e.target.value + "-01")}
                >
                  {Array.from({ length: 60 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const m = (d.getMonth() + 1).toString().padStart(2, "0");
                    const y = d.getFullYear();
                    return (
                      <option key={`${y}-${m}`} value={`${y}-${m}`}>
                        Tháng {m}/{y}
                      </option>
                    );
                  })}
                </select>
              )}
              {viewMode === "year" && (
                <select className="input h-[34px] py-1" value={anchorDateStr.substring(0, 4)} onChange={(e) => setAnchorDateStr(e.target.value + "-01-01")}>
                  {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Phương thức hiển thị">
              <select className="input text-sm h-[34px] py-1" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}>
                <option value="ALL">Tất cả (Đa luồng)</option>
                <option value="CASH">Chỉ Tiền mặt</option>
                <option value="QR">Chỉ Chuyển khoản QR</option>
              </select>
            </Field>
          </div>
        </div>
      </Panel>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!report || !totals ? (
        <Panel>
          <EmptyState>Không có dữ liệu doanh thu trong khoảng thời gian này.</EmptyState>
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
              <span className="text-xs font-medium text-slate-500">Trung bình / mốc</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-blue-600">
                {formatVnd(totals.avgDailyNetRevenue)}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">Tính trên tổng số mốc trong kỳ</span>
            </div>
          </div>

          {/* Biểu đồ doanh thu theo thời gian */}
          <Panel
            title="Biểu đồ phân tích"
            subtitle={`${formatDate(report.range.from)} → ${formatDate(report.range.to)} · ${totals.totalDays} mốc`}
            right={
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                {(methodFilter === "ALL") && (
                  <>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-forest-800"></span><span>Tổng thuần</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span><span>Tiền mặt</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span><span>Mã QR</span></div>
                  </>
                )}
                {methodFilter === "CASH" && (
                   <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span><span>Chỉ Tiền mặt</span></div>
                )}
                {methodFilter === "QR" && (
                   <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span><span>Chỉ Mã QR</span></div>
                )}
              </div>
            }
          >
            {filteredItems.length === 0 ? (
              <EmptyState>Không có dữ liệu trong khoảng thời gian này.</EmptyState>
            ) : (
              <div className="relative pt-6 pb-2">
                <div className="overflow-x-auto pb-8 pt-6 px-8 scrollbar-none">
                  <div className="relative h-64 w-full">
                    <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="net-gradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" className="text-forest-800" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-forest-800" />
                        </linearGradient>
                      </defs>

                      {methodFilter === "ALL" && netPath.polygonD && (
                        <path d={netPath.polygonD} fill="url(#net-gradient)" className="text-forest-800" />
                      )}

                      {/* Cash Line */}
                      {(methodFilter === "ALL" || methodFilter === "CASH") && cashPath.pathD && (
                        <path
                          d={cashPath.pathD}
                          fill="none" stroke="currentColor" strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
                          className="text-blue-500"
                        />
                      )}

                      {/* QR Line */}
                      {(methodFilter === "ALL" || methodFilter === "QR") && qrPath.pathD && (
                        <path
                          d={qrPath.pathD}
                          fill="none" stroke="currentColor" strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
                          className="text-purple-500"
                        />
                      )}

                      {/* Net Line */}
                      {methodFilter === "ALL" && netPath.pathD && (
                        <path
                          d={netPath.pathD}
                          fill="none" stroke="currentColor" strokeWidth="3"
                          vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
                          className="text-forest-800"
                        />
                      )}
                    </svg>
                    
                    {filteredItems.map((item, i) => {
                      const x = filteredItems.length > 1 ? (i / (filteredItems.length - 1)) * 100 : 50;
                      const yNet = item.netVal > 0 ? 100 - (item.netVal / maxDailyAmount) * 90 : 100;
                      const yCash = item.cashVal > 0 ? 100 - (item.cashVal / maxDailyAmount) * 90 : 100;
                      const yQr = item.qrVal > 0 ? 100 - (item.qrVal / maxDailyAmount) * 90 : 100;
                      
                      const showNet = methodFilter === "ALL";
                      const showCash = methodFilter === "ALL" || methodFilter === "CASH";
                      const showQr = methodFilter === "ALL" || methodFilter === "QR";

                      return (
                        <div 
                          key={item.time}
                          className="group absolute top-0 bottom-0 flex flex-col justify-end items-center"
                          style={{ left: `${x}%`, width: '30px', transform: 'translateX(-50%)' }}
                        >
                          {/* Invisible hover column */}
                          <div className="absolute inset-0 w-full hover:bg-slate-500/5 transition-colors z-0" />

                          {/* Dots */}
                          {showNet && (
                            <div className="absolute h-2.5 w-2.5 rounded-full border-2 border-white bg-forest-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                 style={{ top: `${yNet}%`, transform: 'translateY(-50%)' }} />
                          )}
                          {showCash && (
                            <div className="absolute h-2 w-2 rounded-full border-2 border-white bg-blue-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                 style={{ top: `${yCash}%`, transform: 'translateY(-50%)' }} />
                          )}
                          {showQr && (
                            <div className="absolute h-2 w-2 rounded-full border-2 border-white bg-purple-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                 style={{ top: `${yQr}%`, transform: 'translateY(-50%)' }} />
                          )}

                          {/* Tooltip */}
                          <div 
                            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2.5 text-xs text-white opacity-0 shadow-xl transition-all group-hover:-translate-y-2 group-hover:opacity-100 border border-slate-700/50" 
                            style={{ top: `${Math.min(yNet, yCash, yQr)}%`, transform: 'translateY(-100%)', marginTop: '-12px' }}
                          >
                            <div className="text-[11px] text-slate-300 font-semibold mb-1 border-b border-slate-600 pb-1">{formatShortTime(item.time)} - {item.orderCount} đơn</div>
                            <div className="space-y-1">
                              {showNet && <div className="flex justify-between gap-4"><span className="text-forest-300">Tổng</span><strong className="text-white">{formatVnd(item.netVal)}</strong></div>}
                              {showCash && <div className="flex justify-between gap-4"><span className="text-blue-300">Cash</span><strong className="text-white">{formatVnd(item.cashVal)}</strong></div>}
                              {showQr && <div className="flex justify-between gap-4"><span className="text-purple-300">QR</span><strong className="text-white">{formatVnd(item.qrVal)}</strong></div>}
                            </div>
                            <div className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-slate-800"></div>
                          </div>
                          
                          {/* X-axis Label */}
                          <span className="absolute -bottom-6 text-[10px] font-medium text-slate-400 group-hover:text-forest-800 transition-colors whitespace-nowrap">
                            {formatShortTime(item.time)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          {/* Chi tiết theo mốc thời gian */}
          <Panel
            title="Dữ liệu chi tiết"
            right={<span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{filteredItems.length} mốc thời gian</span>}
          >
            <div className="-mx-5 overflow-x-auto px-5 scrollbar-none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="th text-left">THỜI GIAN</th>
                    <th className="th text-right">TIỀN MẶT (CASH)</th>
                    <th className="th text-right">CHUYỂN KHOẢN (QR)</th>
                    <th className="th text-right">ĐÃ HOÀN (REFUNDED)</th>
                    <th className="th text-right">TỔNG THUẦN</th>
                    <th className="th text-right">SỐ ĐƠN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {filteredItems.filter(item => item.grossVal !== 0 || item.refundedVal !== 0 || item.netVal !== 0).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-sm text-slate-500 italic">
                        Không có mốc thời gian nào phát sinh doanh thu.
                      </td>
                    </tr>
                  )}
                  {filteredItems
                    .filter(item => item.grossVal !== 0 || item.refundedVal !== 0 || item.netVal !== 0)
                    .map((item) => (
                    <tr key={item.time} className="hover:bg-slate-50/80 transition-colors">
                      <td className="td font-medium text-slate-800">{formatShortTime(item.time)}</td>
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
