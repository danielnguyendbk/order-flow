"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHeader, Panel, EmptyState, Field, Modal, PageLoading } from "@/components/ui";
import { formatVnd, formatDate } from "@/lib/format";
import {
  downloadRevenueExport,
  getRevenueReport,
  type ApiRevenueReport,
  type RevenueExportFormat,
  type TaxDeclarationExportInput,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { toDateInput } from "@/lib/period";

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toDateInput(d);
}

type MethodFilter = "ALL" | "CASH" | "QR";

const emptyTaxForm = {
  taxpayerName: "",
  taxCode: "",
  activityName: "Dịch vụ ăn uống",
  taxRatePercent: "",
  deductibleExpenses: "0",
  adjustmentsIncrease: "0",
  adjustmentsDecrease: "0",
  exemptIncome: "0",
  carriedLoss: "0",
  scienceFund: "0",
  taxRelief: "0",
  priorOverpayment: "0",
  provisionalTaxPaid: "0",
};

export default function RevenueReportPage() {
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(thirtyDaysAgo());
  const [to, setTo] = useState(today);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [taxExportFormat, setTaxExportFormat] = useState<Exclude<RevenueExportFormat, "xlsx"> | null>(null);
  const [taxForm, setTaxForm] = useState(emptyTaxForm);
  const [exporting, setExporting] = useState<RevenueExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const payload = await getRevenueReport(from, to);
    return payload.data;
  }, [from, to]);

  const { data: report, loading, error } = useApiData<ApiRevenueReport | null>(load, null);

  const summary = report?.summary;
  const byMethod = report?.byMethod;
  const byDate = useMemo(() => report?.byDate ?? [], [report?.byDate]);

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

  const exportExcel = async () => {
    setExportError(null);
    setExporting("xlsx");
    try {
      await downloadRevenueExport(from, to, "xlsx");
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Không thể xuất Excel.");
    } finally {
      setExporting(null);
    }
  };

  const updateTaxField = (field: keyof typeof emptyTaxForm, value: string) => {
    setTaxForm((current) => ({ ...current, [field]: value }));
  };

  const submitTaxExport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taxExportFormat) return;
    const toMoney = (value: string) => Math.max(0, Math.round(Number(value) || 0));
    const tax: TaxDeclarationExportInput = {
      taxpayerName: taxForm.taxpayerName.trim(),
      taxCode: taxForm.taxCode.trim(),
      activityName: taxForm.activityName.trim(),
      taxRatePercent: Number(taxForm.taxRatePercent),
      deductibleExpenses: toMoney(taxForm.deductibleExpenses),
      adjustmentsIncrease: toMoney(taxForm.adjustmentsIncrease),
      adjustmentsDecrease: toMoney(taxForm.adjustmentsDecrease),
      exemptIncome: toMoney(taxForm.exemptIncome),
      carriedLoss: toMoney(taxForm.carriedLoss),
      scienceFund: toMoney(taxForm.scienceFund),
      taxRelief: toMoney(taxForm.taxRelief),
      priorOverpayment: toMoney(taxForm.priorOverpayment),
      provisionalTaxPaid: toMoney(taxForm.provisionalTaxPaid),
    };
    setExportError(null);
    setExporting(taxExportFormat);
    try {
      await downloadRevenueExport(from, to, taxExportFormat, tax);
      setTaxExportFormat(null);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Không thể xuất tờ khai.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return <PageLoading label="Đang đối soát & tổng hợp doanh thu..." subText="Đang tính toán doanh thu thuần, hoàn tiền và sản lượng theo ngày..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo doanh thu"
        description="Doanh thu theo ngày theo phương thức thanh toán. Số tiền hoàn (REFUNDED) không tính vào doanh thu thuần."
      >
        <button type="button" className="btn-ghost" onClick={() => void exportExcel()} disabled={!report || exporting !== null}>
          {exporting === "xlsx" ? "Đang xuất..." : "Xuất Excel"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setTaxExportFormat("tax-revenue")} disabled={!report || exporting !== null}>
          Tờ khai theo doanh thu
        </button>
        <button type="button" className="btn" onClick={() => setTaxExportFormat("tax-revenue-expense")} disabled={!report || exporting !== null}>
          Tờ khai doanh thu - chi phí
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
      {exportError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{exportError}</div>}

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

      <Modal
        open={taxExportFormat !== null}
        onClose={() => setTaxExportFormat(null)}
        eyebrow="XUẤT TỜ KHAI DOCX"
        title={taxExportFormat === "tax-revenue-expense" ? "Tờ khai theo doanh thu - chi phí" : "Tờ khai theo tỷ lệ trên doanh thu"}
        subtitle="Mẫu DOCX được sao từ file gốc trong backend/docs. Hãy xác nhận các chỉ tiêu chưa có trong Order Flow."
        wide
      >
        <form onSubmit={submitTaxExport} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên người nộp thuế">
              <input className="input" value={taxForm.taxpayerName} onChange={(e) => updateTaxField("taxpayerName", e.target.value)} required maxLength={255} />
            </Field>
            <Field label="Mã số thuế">
              <input className="input" value={taxForm.taxCode} onChange={(e) => updateTaxField("taxCode", e.target.value)} required maxLength={30} />
            </Field>
            <Field label="Ngành/hoạt động kinh doanh">
              <input className="input" value={taxForm.activityName} onChange={(e) => updateTaxField("activityName", e.target.value)} required maxLength={255} />
            </Field>
            <Field label="Thuế suất / tỷ lệ thuế (%)" hint="Nhập theo hồ sơ thuế của đơn vị; hệ thống không tự suy đoán từ doanh thu.">
              <input className="input" type="number" min="0" max="100" step="0.01" value={taxForm.taxRatePercent} onChange={(e) => updateTaxField("taxRatePercent", e.target.value)} required />
            </Field>
          </div>

          {taxExportFormat === "tax-revenue-expense" && (
            <div className="grid gap-3 rounded-xl border border-line bg-slate-50 p-4 sm:grid-cols-2">
              <Field label="Chi phí được trừ (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.deductibleExpenses} onChange={(e) => updateTaxField("deductibleExpenses", e.target.value)} required />
              </Field>
              <Field label="Điều chỉnh tăng lợi nhuận (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.adjustmentsIncrease} onChange={(e) => updateTaxField("adjustmentsIncrease", e.target.value)} />
              </Field>
              <Field label="Điều chỉnh giảm lợi nhuận (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.adjustmentsDecrease} onChange={(e) => updateTaxField("adjustmentsDecrease", e.target.value)} />
              </Field>
              <Field label="Thu nhập miễn thuế (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.exemptIncome} onChange={(e) => updateTaxField("exemptIncome", e.target.value)} />
              </Field>
              <Field label="Lỗ được chuyển trong kỳ (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.carriedLoss} onChange={(e) => updateTaxField("carriedLoss", e.target.value)} />
              </Field>
              <Field label="Trích quỹ khoa học công nghệ (VND)">
                <input className="input" type="number" min="0" step="1" value={taxForm.scienceFund} onChange={(e) => updateTaxField("scienceFund", e.target.value)} />
              </Field>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Thuế được miễn/giảm (VND)">
              <input className="input" type="number" min="0" step="1" value={taxForm.taxRelief} onChange={(e) => updateTaxField("taxRelief", e.target.value)} />
            </Field>
            <Field label="Nộp thừa kỳ trước (VND)">
              <input className="input" type="number" min="0" step="1" value={taxForm.priorOverpayment} onChange={(e) => updateTaxField("priorOverpayment", e.target.value)} />
            </Field>
            <Field label="Thuế đã tạm nộp (VND)">
              <input className="input" type="number" min="0" step="1" value={taxForm.provisionalTaxPaid} onChange={(e) => updateTaxField("provisionalTaxPaid", e.target.value)} />
            </Field>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Order Flow chỉ tự điền doanh thu và hoàn tiền. Chi phí, thuế suất, ưu đãi, lỗ chuyển kỳ và số thuế đã nộp phải được đối chiếu với sổ kế toán/chứng từ trước khi nộp cơ quan thuế.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setTaxExportFormat(null)}>Hủy</button>
            <button type="submit" className="btn" disabled={exporting !== null}>
              {exporting ? "Đang tạo DOCX..." : "Tạo và tải DOCX"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
