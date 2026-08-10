"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats, type Tone } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDateTime } from "@/lib/format";
import { inPeriod, type Period } from "@/lib/period";
import {
  getTransactions,
  getCurrentUser,
  resolveReconciliation,
  type ApiSepayTransactionFull,
  type ApiUser,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import {
  RECONCILIATION_CLASSIFICATION_LABEL,
  RECONCILIATION_STATUS_LABEL,
  type Reconciliation,
  type ReconciliationClassification,
} from "@/lib/data";

const CLASSIFICATION_OPTIONS = Object.keys(RECONCILIATION_CLASSIFICATION_LABEL) as ReconciliationClassification[];

const RESOLUTION_ACTIONS = [
  { value: "ACCEPT", label: "Chấp nhận" },
  { value: "REJECT", label: "Từ chối" },
  { value: "REFUND_REQUIRED", label: "Cần hoàn tiền" },
  { value: "LINK_MANUALLY", label: "Liên kết thủ công" },
  { value: "NONE", label: "Không xử lý" },
];

/* 5 loại phân loại → 5 màu badge khác nhau */
const CLASS_TONE: Record<ReconciliationClassification, Tone> = {
  matched: "green",
  underpaid: "amber",
  overpaid: "violet",
  unknown_code: "red",
  duplicate: "blue",
};

const CLASS_DESC: Record<ReconciliationClassification, string> = {
  matched: "Số tiền khớp đúng với đơn hàng.",
  underpaid: "Khách chuyển thiếu so với số tiền cần thanh toán.",
  overpaid: "Khách chuyển thừa so với số tiền cần thanh toán.",
  unknown_code: "Nội dung chuyển khoản không khớp mã đơn nào.",
  duplicate: "SePay gửi webhook trùng lặp cho cùng một giao dịch.",
};

/* Map giao dịch SePay từ backend sang view-model trang Đối soát */
function toReconciliation(tx: ApiSepayTransactionFull): Reconciliation {
  const expected = Number(tx.payment?.expectedAmount ?? 0);
  const received = Number(tx.amountIn);
  const difference = Number(tx.differenceAmount ?? received - expected);

  let classification: ReconciliationClassification = "unknown_code";
  if (tx.matchStatus === "MATCHED") classification = "matched";
  else if (tx.matchStatus === "WRONG_CODE") classification = "unknown_code";
  else if (tx.matchStatus === "UNMATCHED" && tx.payment) {
    classification = difference < 0 ? "underpaid" : difference > 0 ? "overpaid" : "matched";
  } else if (tx.matchStatus === "REVIEWED") {
    classification = difference < 0 ? "underpaid" : difference > 0 ? "overpaid" : "matched";
  }

  const resolved = tx.matchStatus === "REVIEWED" || tx.matchStatus === "MATCHED";

  return {
    id: tx.id,
    code: tx.code ?? `SP${tx.sepayTransactionId}`,
    orderCode: tx.payment?.order?.orderCode ?? undefined,
    orderId: tx.payment?.order?.id ?? undefined,
    sepayId: tx.sepayTransactionId,
    amountExpected: expected,
    amountReceived: received,
    classification,
    reason: tx.content ?? (CLASS_DESC[classification] ?? "Giao dịch cần kiểm tra."),
    status: resolved ? "resolved" : "open",
    resolvedBy: tx.resolvedBy?.fullName ?? (tx.matchStatus === "MATCHED" ? "Hệ thống" : undefined),
    resolvedAt: tx.resolvedAt ?? undefined,
    resolveNote: tx.resolutionNote ?? undefined,
    createdAt: tx.receivedAt,
  };
}

export default function ReconciliationsPage() {
  const toast = useToast();

  const [q, setQ] = useState("");
  const [classification, setClassification] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState<Period | "">("");
  const [me, setMe] = useState<ApiUser | null>(null);

  const load = useCallback(async () => {
    const [payload, mePayload] = await Promise.all([
      getTransactions(),
      getCurrentUser().catch(() => null),
    ]);
    setMe(mePayload?.data ?? null);
    return payload.data.map(toReconciliation);
  }, []);

  const { data: rows, loading, error, reload } = useApiData(load, [] as Reconciliation[]);
  const [resolving, setResolving] = useState<Reconciliation | null>(null);
  const [resolutionAction, setResolutionAction] = useState("ACCEPT");
  const [resolveNote, setResolveNote] = useState("");
  const [detailItem, setDetailItem] = useState<Reconciliation | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (classification && r.classification !== classification) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (period && !inPeriod(r.createdAt, period)) return false;
      if (term) {
        const hay = `${r.code} ${r.orderCode ?? ""} ${r.sepayId}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, classification, statusFilter, period]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      matched: rows.filter((r) => r.classification === "matched").length,
      discrepancy: rows.filter((r) => r.classification === "underpaid" || r.classification === "overpaid").length,
      unknownCode: rows.filter((r) => r.classification === "unknown_code").length,
      duplicates: rows.filter((r) => r.classification === "duplicate").length,
      resolved: rows.filter((r) => r.status === "resolved").length,
    }),
    [rows]
  );

  const diffText = (r: Reconciliation) => {
    const diff = r.amountReceived - r.amountExpected;
    if (diff === 0) return <span className="text-slate-400">0₫</span>;
    return (
      <span className={diff > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
        {diff > 0 ? "+" : "−"}
        {formatVnd(Math.abs(diff))}
      </span>
    );
  };

  const openResolve = (r: Reconciliation) => {
    setResolving(r);
    setResolutionAction("ACCEPT");
    setResolveNote("");
  };

  const resolve = async () => {
    if (!resolving) return;
    if (!me) {
      toast.push("Không lấy được tài khoản đang đăng nhập.", "error");
      return;
    }
    setBusy(true);
    try {
      await resolveReconciliation(resolving.id, {
        resolvedByUserId: me.id,
        resolutionAction,
        resolutionNote: resolveNote.trim() || "Admin xác nhận từ Web Admin",
      });
      await reload();
      toast.push(`Đã giải quyết giao dịch ${resolving.code}.`, "success");
      setResolving(null);
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể giải quyết giao dịch.", "error");
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = Boolean(q || classification || statusFilter || period);

  return (
    <div>
      <PageHeader
        title="Đối soát giao dịch"
        description="Đối chiếu giao dịch SePay với đơn hàng — nhận diện thiếu/thừa tiền, sai mã, trùng lặp webhook."
      />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-4 text-sm text-muted">Đang tải giao dịch từ backend...</div>}

      <Stats
        items={[
          { label: "Tổng giao dịch", value: stats.total },
          { label: "Đúng tiền", value: stats.matched, tone: "green" },
          { label: "Sai lệch (thiếu + thừa)", value: stats.discrepancy, tone: "amber" },
          { label: "Sai mã", value: stats.unknownCode, tone: "red" },
          { label: "Trùng lặp", value: stats.duplicates, tone: "blue" },
          { label: "Đã xử lý", value: stats.resolved, tone: "teal" },
        ]}
      />

      {/* Bộ lọc */}
      <Panel className="mb-6">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3.5">
          <div className="flex-1 min-w-[240px]">
            <Field label="Tìm kiếm">
              <input
                className="input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Mã giao dịch, mã đơn, SePay ID..."
              />
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="Phân loại">
              <select className="input" value={classification} onChange={(e) => setClassification(e.target.value)}>
                <option value="">Tất cả phân loại</option>
                {CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {RECONCILIATION_CLASSIFICATION_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="Trạng thái">
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="open">Chưa xử lý</option>
                <option value="resolved">Đã xử lý</option>
              </select>
            </Field>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="btn-ghost h-10 px-3.5"
              onClick={() => {
                setQ("");
                setClassification("");
                setStatusFilter("");
                setPeriod("");
              }}
            >
              Xóa lọc
            </button>
          )}
        </form>
      </Panel>

      {/* Bảng đối soát */}
      <Panel
        title="Danh sách giao dịch"
        right={<span className="text-sm text-muted">Hiển thị <strong className="text-ink">{filtered.length}</strong> giao dịch</span>}
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Mã giao dịch</th>
                <th className="th">Đơn liên quan</th>
                <th className="th">SePay ID</th>
                <th className="th text-right">Dự kiến</th>
                <th className="th text-right">Đã nhận</th>
                <th className="th text-right">Chênh lệch</th>
                <th className="th">Phân loại</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState>Không có giao dịch phù hợp bộ lọc hiện tại.</EmptyState>
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-soft transition-colors">
                  <td className="td whitespace-nowrap">
                    <strong className="block font-mono text-sm text-ink">{r.code}</strong>
                    <small className="text-[11px] text-muted">{formatDateTime(r.createdAt)}</small>
                  </td>
                  <td className="td">
                    {r.orderId && r.orderCode ? (
                      <Link
                        href={`/orders/${r.orderId}`}
                        className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                      >
                        {r.orderCode}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="td font-mono text-xs text-slate-600">{r.sepayId}</td>
                  <td className="td text-right tabular-nums text-slate-700">{r.amountExpected ? formatVnd(r.amountExpected) : "—"}</td>
                  <td className="td text-right font-semibold tabular-nums text-ink">{formatVnd(r.amountReceived)}</td>
                  <td className="td text-right tabular-nums">{diffText(r)}</td>
                  <td className="td whitespace-nowrap">
                    <Badge tone={CLASS_TONE[r.classification]}>
                      {RECONCILIATION_CLASSIFICATION_LABEL[r.classification]}
                    </Badge>
                  </td>
                  <td className="td whitespace-nowrap">
                    <Badge tone={r.status === "resolved" ? "green" : "amber"}>
                      {RECONCILIATION_STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                  <td className="td whitespace-nowrap">
                    {r.status === "open" ? (
                      <button type="button" className="btn text-xs w-20 justify-center px-3 py-1.5 rounded-full whitespace-nowrap" onClick={() => openResolve(r)}>
                        Xử lý
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost text-xs w-20 justify-center px-3 py-1.5 rounded-full whitespace-nowrap" onClick={() => setDetailItem(r)}>
                        Chi tiết
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Modal xử lý */}
      <Modal
        open={resolving !== null}
        onClose={() => setResolving(null)}
        eyebrow="XỬ LÝ GIAO DỊCH"
        title={`Giải quyết ${resolving?.code ?? ""}`}
        subtitle="Xác nhận cách xử lý cho giao dịch chưa khớp này."
      >
        {resolving && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <Badge tone={CLASS_TONE[resolving.classification]}>
                {RECONCILIATION_CLASSIFICATION_LABEL[resolving.classification]}
              </Badge>
              <span className="text-sm text-muted">{CLASS_DESC[resolving.classification]}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line bg-white p-3">
                <span className="block text-[11px] text-muted">Dự kiến</span>
                <strong className="block text-sm tabular-nums text-ink">{formatVnd(resolving.amountExpected)}</strong>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <span className="block text-[11px] text-muted">Đã nhận</span>
                <strong className="block text-sm tabular-nums text-ink">{formatVnd(resolving.amountReceived)}</strong>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <span className="block text-[11px] text-muted">Lệch</span>
                <strong className="block text-sm tabular-nums text-ink">
                  {resolving.amountReceived - resolving.amountExpected >= 0 ? "+" : "−"}
                  {formatVnd(Math.abs(resolving.amountReceived - resolving.amountExpected))}
                </strong>
              </div>
            </div>
            <Field label="Lý do phân loại (hệ thống)">
              <p className="input bg-slate-50 text-sm text-slate-700">{resolving.reason}</p>
            </Field>
            <Field label="Cách xử lý">
              <select className="input" value={resolutionAction} onChange={(e) => setResolutionAction(e.target.value)}>
                {RESOLUTION_ACTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ghi chú xử lý">
              <textarea
                className="input min-h-[80px] resize-y"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Ví dụ: đã yêu cầu khách bổ sung, đã cộng dư vào ví..."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setResolving(null)}>
                Hủy
              </button>
              <button type="button" className="btn" onClick={resolve} disabled={busy}>
                {busy ? "Đang xử lý..." : "Giải quyết"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal chi tiết đối soát */}
      <Modal
        open={detailItem !== null}
        onClose={() => setDetailItem(null)}
        eyebrow="CHI TIẾT ĐỐI SOÁT"
        title={`Thông tin đối soát ${detailItem?.code ?? ""}`}
        subtitle="Chi tiết kết quả xử lý và thông tin liên quan."
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <Badge tone={CLASS_TONE[detailItem.classification]}>
                {RECONCILIATION_CLASSIFICATION_LABEL[detailItem.classification]}
              </Badge>
              <span className="text-sm text-muted">{CLASS_DESC[detailItem.classification]}</span>
            </div>

            <dl className="divide-y divide-line-soft rounded-xl border border-line bg-white px-4 py-1 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Mã giao dịch</dt>
                <dd className="font-mono font-semibold text-ink">{detailItem.code}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Đơn liên quan</dt>
                <dd className="font-mono font-semibold text-brand-700">
                  {detailItem.orderId && detailItem.orderCode ? (
                    <Link href={`/orders/${detailItem.orderId}`} className="hover:underline">
                      {detailItem.orderCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">SePay ID</dt>
                <dd className="font-mono text-slate-700">{detailItem.sepayId}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Dự kiến / Đã nhận</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {detailItem.amountExpected ? formatVnd(detailItem.amountExpected) : "—"} / {formatVnd(detailItem.amountReceived)}
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Trạng thái</dt>
                <dd>
                  <Badge tone={detailItem.status === "resolved" ? "green" : "amber"}>
                    {RECONCILIATION_STATUS_LABEL[detailItem.status]}
                  </Badge>
                </dd>
              </div>
              {detailItem.resolvedBy && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">Người xử lý</dt>
                  <dd className="font-medium text-ink">{detailItem.resolvedBy}</dd>
                </div>
              )}
              {detailItem.resolvedAt && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">Thời gian xử lý</dt>
                  <dd className="tabular-nums text-slate-700">{formatDateTime(detailItem.resolvedAt)}</dd>
                </div>
              )}
              {detailItem.resolveNote && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">Ghi chú xử lý</dt>
                  <dd className="text-slate-700">{detailItem.resolveNote}</dd>
                </div>
              )}
            </dl>

            <div className="flex justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => setDetailItem(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
