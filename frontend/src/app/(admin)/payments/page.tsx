"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Panel, Badge, EmptyState, paymentTone, Field, Modal, Stats } from "@/components/ui";
import { PeriodFilter } from "@/components/PeriodFilter";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDateTime, formatDate, formatTime } from "@/lib/format";
import { inPeriod, type Period } from "@/lib/period";
import {
  payments as allPayments,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  type Payment,
  type PaymentStatus,
  type PaymentType,
} from "@/lib/data";

const STATUS_OPTIONS = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];
const TYPE_OPTIONS = Object.keys(PAYMENT_TYPE_LABEL) as PaymentType[];

export default function PaymentsPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [period, setPeriod] = useState<Period | "">("");
  const [needsReview, setNeedsReview] = useState(false);
  const [rows, setRows] = useState<Payment[]>(allPayments);
  const [reviewPayment, setReviewPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState<PaymentStatus>("pending");
  const [editNote, setEditNote] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (status && p.status !== status) return false;
      if (type && p.type !== type) return false;
      if (needsReview && !["underpaid", "unknown_code", "failed", "duplicate", "overpaid"].includes(p.status)) return false;
      if (period && !inPeriod(p.createdAt, period)) return false;
      if (term) {
        const hay = `${p.code} ${p.sepayId ?? ""} ${p.user.username} ${p.user.telegramId} ${p.orderCode ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, status, type, needsReview, period]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      matched: rows.filter((p) => p.status === "matched").length,
      pending: rows.filter((p) => p.status === "pending").length,
      needsReview: rows.filter((p) => ["underpaid", "unknown_code", "failed"].includes(p.status)).length,
      duplicates: rows.filter((p) => p.status === "duplicate").length,
      received: rows.reduce((s, p) => s + p.amountReceived, 0),
      filteredTotal: filtered.length,
    }),
    [rows, filtered]
  );

  const openReview = (p: Payment) => {
    setReviewPayment(p);
    setEditAmount(String(p.amountReceived));
    setEditStatus(p.status);
    setEditNote(p.note ?? "");
  };

  const saveReview = (e: FormEvent) => {
    e.preventDefault();
    if (!reviewPayment) return;
    const amount = Number(String(editAmount).replace(/[^0-9]/g, ""));
    setRows((prev) =>
      prev.map((p) => (p.id === reviewPayment.id ? { ...p, amountReceived: amount, status: editStatus, note: editNote } : p))
    );
    toast.push(`Đã lưu kiểm tra giao dịch ${reviewPayment.code}.`, "success");
    setReviewPayment(null);
  };

  const fulfill = (p: Payment) => {
    setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, status: "matched" } : r)));
    toast.push(`Đã duyệt & giao hàng cho đơn ${p.orderCode ?? p.code}.`, "success");
    setReviewPayment(null);
  };

  const removePayment = (p: Payment) => {
    setRows((prev) => prev.filter((r) => r.id !== p.id));
    toast.push(`Đã xóa giao dịch ${p.code}.`, "warning");
    setReviewPayment(null);
  };

  const canDelete = (p: Payment) => !p.orderCode && p.status !== "matched";

  return (
    <div>
      <PageHeader title="Đối soát Thanh toán" description="Đối soát giao dịch tự động từ SePay QR Code và xác nhận thu tiền mặt từ nhân viên phục vụ.">
        <Link href="/payments?needsReview=1" className={needsReview ? "btn" : "btn-ghost"}>Chỉ cần xử lý</Link>
        <Link href="/payments" className="btn-ghost">Tất cả giao dịch</Link>
      </PageHeader>

      <Stats
        items={[
          { label: "Tổng giao dịch", value: stats.total },
          { label: "Đã khớp (SePay/Mặt)", value: stats.matched, tone: "green" },
          { label: "Chờ SePay", value: stats.pending, tone: "amber" },
          { label: "Cần kiểm tra (Lệch)", value: stats.needsReview, tone: "red" },
          { label: "Trùng webhook", value: stats.duplicates, tone: "amber" },
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
            <Link href="/payments?needsReview=1" className="btn">Mở danh sách cần xử lý</Link>
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
          <div className="w-full sm:w-48">
            <Field label="Loại giao dịch">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tất cả loại</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{PAYMENT_TYPE_LABEL[t]}</option>)}
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
          {(q || status || type || needsReview || period) && (
            <button type="button" className="btn-ghost h-10 px-3.5" onClick={() => { setQ(""); setStatus(""); setType(""); setNeedsReview(false); setPeriod(""); }}>
              Xóa lọc
            </button>
          )}
        </form>
      </Panel>

      <Panel
        title="Giao dịch mới nhất"
        subtitle="Dòng thiếu tiền, sai mã hoặc lỗi sẽ được tô nền để admin xử lý trước."
        right={<span className="text-sm text-muted">{filtered.length}/{stats.filteredTotal} dòng</span>}
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
                const delta = payment.amountReceived - payment.amountExpected;
                const attention = ["underpaid", "unknown_code", "failed"].includes(payment.status);
                return (
                  <tr key={payment.id} className={attention ? "bg-red-50/50" : "hover:bg-surface-soft"}>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <strong className="font-bold text-ink">{payment.code}</strong>
                        <Badge tone="gray">{PAYMENT_TYPE_LABEL[payment.type]}</Badge>
                      </div>
                      <small className="block text-xs text-muted">SePay: {payment.sepayId ?? "Chưa có"}</small>
                    </td>
                    <td className="td">
                      <strong className="text-sm text-ink">@{payment.user.username || payment.user.telegramId || "-"}</strong>
                      <small className="block text-xs text-muted">
                        {payment.orderCode ? `Đơn ${payment.orderCode}` : "Chưa liên kết đơn"}
                      </small>
                    </td>
                    <td className="td">
                      <strong className="text-sm font-bold tabular-nums text-ink">{formatVnd(payment.amountReceived)}</strong>
                      <small className="block text-xs text-muted">Dự kiến: {formatVnd(payment.amountExpected)}</small>
                    </td>
                    <td className="td whitespace-nowrap">
                      <Badge tone={paymentTone(payment.status)}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                    </td>
                    <td className="td text-xs whitespace-nowrap">
                      <span className="block font-medium text-slate-700">{formatDate(payment.createdAt)}</span>
                      <span className="block text-[11px] text-slate-400">{formatTime(payment.createdAt)}</span>
                    </td>
                    <td className="td">
                      <button type="button" className="btn-ghost" onClick={() => openReview(payment)}>Chi tiết</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Modal chi tiết giao dịch */}
      <Modal
        open={reviewPayment !== null}
        onClose={() => setReviewPayment(null)}
        eyebrow="THANH TOÁN"
        title={`Chi tiết giao dịch ${reviewPayment?.code ?? ""}`}
        subtitle="Thông tin chi tiết giao dịch, số tiền nhận, trạng thái và ghi chú."
      >
        {reviewPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              {[
                { label: "SePay ID", value: reviewPayment.sepayId ?? "Chưa có" },
                { label: "Số tiền nhận", value: formatVnd(reviewPayment.amountReceived) },
                { label: "Dự kiến", value: formatVnd(reviewPayment.amountExpected) },
                { 
                  label: "Chênh lệch", 
                  value: reviewPayment.amountReceived - reviewPayment.amountExpected !== 0
                    ? `${reviewPayment.amountReceived - reviewPayment.amountExpected > 0 ? "+" : ""}${formatVnd(reviewPayment.amountReceived - reviewPayment.amountExpected)}`
                    : "Đúng số tiền"
                },
                { label: "Trạng thái", value: PAYMENT_STATUS_LABEL[reviewPayment.status] },
              ].map((item) => (
                <div key={item.label}>
                  <span className="block text-xs text-muted">{item.label}</span>
                  <strong className="block text-sm font-bold text-ink">{item.value}</strong>
                </div>
              ))}
            </div>

            <form onSubmit={saveReview} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số tiền nhận">
                  <input className="input" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </Field>
                <Field label="Trạng thái">
                  <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as PaymentStatus)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Ghi chú">
                <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ghi chú xử lý" />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setReviewPayment(null)}>Đóng</button>
                <button type="submit" className="btn">Lưu</button>
              </div>
            </form>

            {(reviewPayment.status === "pending" || reviewPayment.status === "underpaid") &&
              reviewPayment.amountReceived >= reviewPayment.amountExpected && reviewPayment.type !== "manual" && (
                <button type="button" className="btn w-full" onClick={() => fulfill(reviewPayment)}>Duyệt &amp; giao hàng</button>
              )}
            {canDelete(reviewPayment) && (
              <button type="button" className="btn-danger w-full" onClick={() => removePayment(reviewPayment)}>Xóa giao dịch</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
