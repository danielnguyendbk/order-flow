"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Panel, Badge, EmptyState, paymentTone, Field, Stats, PageLoading } from "@/components/ui";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatVnd, formatDateTime, formatDate, formatTime } from "@/lib/format";
import { inPeriod, type Period } from "@/lib/period";
import { getTransactions, type ApiSepayTransactionFull } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import {
  PAYMENT_STATUS_LABEL,
  type Payment,
  type PaymentStatus,
} from "@/lib/data";

/* Map giao dịch SePay từ backend sang view-model trang Thanh toán */
interface PaymentRow extends Payment {
  orderId?: string;
}

function toPaymentView(tx: ApiSepayTransactionFull): PaymentRow {
  const expected = Number(tx.payment?.expectedAmount ?? 0);
  const received = Number(tx.amountIn);
  const diff = received - expected;

  let status: PaymentStatus = "pending";
  if (tx.matchStatus === "MATCHED") status = "matched";
  else if (tx.matchStatus === "WRONG_CODE") status = "unknown_code";
  else if (tx.payment && diff !== 0) status = diff < 0 ? "underpaid" : "overpaid";
  else if (tx.matchStatus === "REVIEWED") status = diff < 0 ? "underpaid" : diff > 0 ? "overpaid" : "matched";

  return {
    id: tx.id,
    code: tx.code ?? `SP${tx.sepayTransactionId}`,
    type: tx.payment ? "order" : "manual",
    sepayId: tx.sepayTransactionId,
    orderCode: tx.payment?.order?.orderCode ?? undefined,
    orderId: tx.payment?.order?.id ?? undefined,
    amountExpected: expected,
    amountReceived: received,
    status,
    note: tx.resolutionNote ?? tx.content ?? undefined,
    createdAt: tx.receivedAt,
    user: { telegramId: "", username: "" },
  };
}

const STATUS_OPTIONS = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

function PaymentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<Period | "">("");
  const needsReview = searchParams.get("needsReview") === "1";
  const [detail, setDetail] = useState<PaymentRow | null>(null);

  const setNeedsReview = (enabled: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (enabled) params.set("needsReview", "1");
    else params.delete("needsReview");
    const query = params.toString();
    router.replace(query ? `/payments?${query}` : "/payments", { scroll: false });
  };

  const openNeedsReview = () => {
    setNeedsReview(true);
    window.requestAnimationFrame(() => {
      document.getElementById("payment-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const load = useCallback(async () => {
    const payload = await getTransactions();
    return payload.data.map(toPaymentView);
  }, []);

  const { data: rows, loading, error, reload } = useApiData<PaymentRow[]>(load, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (status && p.status !== status) return false;
      if (needsReview && !["underpaid", "unknown_code", "overpaid", "failed"].includes(p.status)) return false;
      if (period && !inPeriod(p.createdAt, period)) return false;
      if (term) {
        const hay = `${p.code} ${p.sepayId ?? ""} ${p.user.username} ${p.user.telegramId} ${p.orderCode ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, status, needsReview, period]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      matched: rows.filter((p) => p.status === "matched").length,
      pending: rows.filter((p) => p.status === "pending").length,
      needsReview: rows.filter((p) => ["underpaid", "unknown_code", "overpaid", "failed"].includes(p.status)).length,
      received: rows.reduce((s, p) => s + p.amountReceived, 0),
    }),
    [rows]
  );

  const hasFilters = Boolean(q || status || needsReview || period);

  if (loading && rows.length === 0) {
    return <PageLoading label="Đang tải danh sách giao dịch..." subText="Đang lấy dữ liệu thanh toán tiền mặt và chuyển khoản..." />;
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader title="Đối soát Thanh toán" description="Đối soát giao dịch tự động từ SePay QR Code và xác nhận thu tiền mặt từ nhân viên phục vụ.">
        <Link href="/payments?needsReview=1" className={needsReview ? "btn" : "btn-ghost"}>Chỉ cần xử lý</Link>
        <Link href="/payments" className="btn-ghost">Tất cả giao dịch</Link>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Stats
            items={[
              { label: "Tổng giao dịch", value: stats.total },
              { label: "Đã khớp (SePay/Mặt)", value: stats.matched, tone: "green" },
              { label: "Chờ SePay", value: stats.pending, tone: "amber" },
              { label: "Cần kiểm tra (Lệch)", value: stats.needsReview, tone: "red" },
              { label: "Tổng tiền thu", value: formatVnd(stats.received), tone: "teal" },
            ]}
          />

      {stats.needsReview > 0 && (
        <Panel className="mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="font-bold text-amber-800">Có {stats.needsReview} giao dịch cần kiểm tra</strong>
              <p className="mt-0.5 text-sm text-amber-700">Ưu tiên xử lý giao dịch thiếu tiền, sai mã hoặc lỗi trước khi kiểm tra các dòng đã khớp.</p>
            </div>
            <button type="button" className="btn" onClick={openNeedsReview}>Mở danh sách cần xử lý</button>
          </div>
        </Panel>
      )}

      <Panel className="mb-6">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3.5">
          <div className="flex-1 min-w-[240px]">
            <Field label="Tìm kiếm">
              <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã đơn, SePay ID, username..." />
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="Trạng thái">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-full sm:w-72">
            <Field label="Thời gian">
              <PeriodFilter value={period} onChange={setPeriod} />
            </Field>
          </div>
          <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-line bg-slate-50/80">
            <input type="checkbox" id="needsReviewPayments" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} className="h-4 w-4 rounded border-line accent-forest-800 cursor-pointer" />
            <label htmlFor="needsReviewPayments" className="text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap">Chỉ dòng cần xử lý</label>
          </div>
          {hasFilters && (
            <button type="button" className="btn-ghost h-10 px-3.5" onClick={() => { setQ(""); setStatus(""); setNeedsReview(false); setPeriod(""); }}>
              Xóa lọc
            </button>
          )}
        </form>
      </Panel>

      <div id="payment-list" className="scroll-mt-4">
        <Panel
          title="Giao dịch mới nhất"
          subtitle="Dòng thiếu tiền, sai mã hoặc lỗi sẽ được tô nền để admin xử lý trước."
          right={
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{filtered.length} dòng</span>
              <button type="button" className="btn-ghost text-xs" onClick={() => void reload()} disabled={loading}>Làm mới</button>
            </div>
          }
        >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Giao dịch</th>
                <th className="th">Liên kết</th>
                <th className="th">Số tiền</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thời gian</th>
                <th className="th">Xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState>Không có giao dịch phù hợp bộ lọc hiện tại.</EmptyState></td></tr>
              )}
              {filtered.map((payment) => {
                const attention = ["underpaid", "unknown_code", "failed", "overpaid"].includes(payment.status);
                return (
                  <tr key={payment.id} className={attention ? "bg-red-50/50" : "hover:bg-surface-soft"}>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <strong className="font-bold text-ink">{payment.code}</strong>
                        <Badge tone="gray">{payment.type === "order" ? "Đơn hàng" : "Thủ công"}</Badge>
                      </div>
                      <small className="block text-xs text-muted">SePay: {payment.sepayId ?? "Chưa có"}</small>
                    </td>
                    <td className="td">
                      <strong className="text-sm text-ink">
                        {payment.orderCode && payment.orderId ? (
                          <Link href={`/orders/${payment.orderId}`} className="font-mono text-brand-700 hover:underline">
                            {payment.orderCode}
                          </Link>
                        ) : payment.orderCode ? (
                          <span className="font-mono">{payment.orderCode}</span>
                        ) : (
                          "Chưa liên kết đơn"
                        )}
                      </strong>
                      <small className="block text-xs text-muted">
                        {payment.user.username ? `@${payment.user.username}` : ""}
                      </small>
                    </td>
                    <td className="td">
                      <strong className="text-sm font-bold tabular-nums text-ink">{formatVnd(payment.amountReceived)}</strong>
                      <small className="block text-xs text-muted">
                        {payment.amountExpected > 0 ? `Dự kiến: ${formatVnd(payment.amountExpected)}` : "Giao dịch ngoài đơn"}
                      </small>
                    </td>
                    <td className="td whitespace-nowrap">
                      <Badge tone={paymentTone(payment.status)}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                    </td>
                    <td className="td text-xs whitespace-nowrap">
                      <span className="block font-medium text-slate-700">{formatDate(payment.createdAt)}</span>
                      <span className="block text-[11px] text-slate-400">{formatTime(payment.createdAt)}</span>
                    </td>
                    <td className="td">
                      <button type="button" className="btn-ghost" onClick={() => setDetail(payment)}>Chi tiết</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </Panel>
      </div>

      {/* Modal chi tiết giao dịch (chỉ đọc) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="eyebrow mb-0.5">THANH TOÁN</p>
                <h2 className="text-lg font-bold text-ink">Chi tiết giao dịch {detail.code}</h2>
                <p className="mt-0.5 text-sm text-muted">Thông tin chi tiết giao dịch và hướng dẫn xử lý.</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Đóng" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">×</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              {[
                { label: "SePay ID", value: detail.sepayId ?? "Chưa có" },
                { label: "Số tiền nhận", value: formatVnd(detail.amountReceived) },
                { label: "Dự kiến", value: detail.amountExpected > 0 ? formatVnd(detail.amountExpected) : "—" },
                {
                  label: "Chênh lệch",
                  value: detail.amountReceived - detail.amountExpected !== 0
                    ? `${detail.amountReceived - detail.amountExpected > 0 ? "+" : "−"}${formatVnd(Math.abs(detail.amountReceived - detail.amountExpected))}`
                    : "Đúng số tiền",
                },
                { label: "Trạng thái", value: PAYMENT_STATUS_LABEL[detail.status] },
                { label: "Thời gian", value: formatDateTime(detail.createdAt) },
              ].map((item) => (
                <div key={item.label}>
                  <span className="block text-xs text-muted">{item.label}</span>
                  <strong className="block text-sm font-bold text-ink">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {detail.orderCode && detail.orderId ? (
                <Link href={`/orders/${detail.orderId}`} className="btn w-full justify-center">Mở đơn hàng liên quan →</Link>
              ) : detail.orderCode ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Đơn liên quan: <strong className="font-mono">{detail.orderCode}</strong></p>
              ) : (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Giao dịch chưa liên kết đơn. Kiểm tra tại trang <Link href="/reconciliations" className="font-semibold underline">Đối soát</Link> để xử lý.
                </p>
              )}
              {detail.note && (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <strong className="block text-slate-800">Ghi chú</strong>
                  {detail.note}
                </p>
              )}
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Giao dịch thiếu/thừa/sai mã được xử lý tại trang <Link href="/reconciliations" className="font-semibold text-brand-700 hover:underline">Đối soát giao dịch</Link> hoặc từ trang <Link href="/orders" className="font-semibold text-brand-700 hover:underline">Đơn hàng</Link>.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setDetail(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsPageInner />
    </Suspense>
  );
}
