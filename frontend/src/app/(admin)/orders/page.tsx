"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader, Panel, Badge, EmptyState, orderPaymentTone, orderFulfillmentTone, Field, Modal } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDateTime, formatDate, formatTime } from "@/lib/format";
import { 
  orders as allOrders, 
  ORDER_PAYMENT_STATUS_LABEL, 
  ORDER_FULFILLMENT_STATUS_LABEL, 
  type Order, 
  type OrderPaymentStatus, 
  type OrderFulfillmentStatus 
} from "@/lib/data";

const PAYMENT_STATUS_OPTIONS = Object.keys(ORDER_PAYMENT_STATUS_LABEL) as OrderPaymentStatus[];
const FULFILLMENT_STATUS_OPTIONS = Object.keys(ORDER_FULFILLMENT_STATUS_LABEL) as OrderFulfillmentStatus[];

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [needsAction, setNeedsAction] = useState(searchParams.get("needsAction") === "1");
  const [rows, setRows] = useState<Order[]>(allOrders);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [completeOrder, setCompleteOrder] = useState<Order | null>(null);
  const [completeNote, setCompleteNote] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
      if (fulfillmentStatus && o.fulfillmentStatus !== fulfillmentStatus) return false;
      if (needsAction && o.paymentStatus !== "PAYMENT_REVIEW" && o.fulfillmentStatus !== "QUEUED") return false;
      if (term) {
        const hay = `${o.code} ${o.user.username} ${o.user.telegramId} ${o.productName} ${o.user.firstName} ${o.user.lastName}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, paymentStatus, fulfillmentStatus, needsAction]);

  const stats = useMemo(() => {
    const revenue = filtered.filter((o) => o.fulfillmentStatus !== "CANCELLED").reduce((s, o) => s + o.amountVnd, 0);
    const costOfGoods = filtered.filter((o) => o.fulfillmentStatus === "DELIVERED").reduce((s, o) => s + o.costVnd, 0);
    return {
      total: filtered.length,
      pendingPayment: filtered.filter((o) => o.paymentStatus === "UNPAID" || o.paymentStatus === "PENDING").length,
      needsReview: filtered.filter((o) => o.paymentStatus === "PAYMENT_REVIEW" || o.fulfillmentStatus === "QUEUED").length,
      delivered: filtered.filter((o) => o.fulfillmentStatus === "DELIVERED").length,
      revenue,
      costOfGoods,
      grossProfit: revenue - costOfGoods,
    };
  }, [filtered]);

  const hasFilters = Boolean(q || paymentStatus || fulfillmentStatus || needsAction);

  const cancelOrder = (o: Order) => {
    setRows((prev) => prev.map((r) => (r.id === o.id ? { ...r, fulfillmentStatus: "CANCELLED", paymentStatus: "REFUNDED" } : r)));
    toast.push(`Đã hủy đơn ${o.code}.`, "success");
  };

  const resolveReview = (o: Order) => {
    setRows((prev) => prev.map((r) => (r.id === o.id ? { ...r, reviewReason: undefined, paymentStatus: "PAID" } : r)));
    toast.push(`Đã bỏ kiểm tra đơn ${o.code}.`, "success");
  };

  const saveReview = (e: FormEvent) => {
    e.preventDefault();
    if (!reviewOrder) return;
    setRows((prev) => prev.map((r) => (r.id === reviewOrder.id ? { ...r, reviewReason, paymentStatus: "PAYMENT_REVIEW" } : r)));
    toast.push(`Đã gắn cờ kiểm tra cho đơn ${reviewOrder.code}.`, "success");
    setReviewOrder(null);
    setReviewReason("");
  };

  const completeService = (e: FormEvent) => {
    e.preventDefault();
    if (!completeOrder) return;
    setRows((prev) => prev.map((r) => (r.id === completeOrder.id ? { ...r, fulfillmentStatus: "DELIVERED", adminNote: completeNote } : r)));
    toast.push(`Đã hoàn tất xử lý/giao hàng đơn ${completeOrder.code}.`, "success");
    setCompleteOrder(null);
    setCompleteNote("");
  };

  return (
    <div>
      <PageHeader title="Đơn hàng" description="Theo dõi trạng thái thanh toán và quy trình thực hiện (xử lý/giao hàng) chuyên biệt." />

      {/* Tóm tắt */}
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <div className="flex items-baseline justify-between">
            <strong className="font-bold text-ink">Luồng đơn</strong>
            <span className="text-xs text-muted">{stats.total} đơn trong phạm vi hiện tại</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-amber-50 p-3">
              <dt className="text-xs font-medium text-amber-700">Chờ TT</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-amber-700">{stats.pendingPayment}</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <dt className="text-xs font-medium text-red-700">Cần xử lý</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-red-700">{stats.needsReview}</dd>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <dt className="text-xs font-medium text-emerald-700">Đã giao</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">{stats.delivered}</dd>
            </div>
          </div>
        </Panel>
        <Panel>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs font-medium text-muted">Doanh thu</dt>
              <dd className="mt-1 text-lg font-extrabold tabular-nums text-ink">{formatVnd(stats.revenue)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Giá vốn</dt>
              <dd className="mt-1 text-lg font-extrabold tabular-nums text-ink">{formatVnd(stats.costOfGoods)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Lợi nhuận gộp</dt>
              <dd className={`mt-1 text-lg font-extrabold tabular-nums ${stats.grossProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatVnd(stats.grossProfit)}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {/* Bộ lọc */}
      <Panel
        title="Tra cứu đơn hàng"
        subtitle="Tìm nhanh theo mã đơn, khách hàng hoặc trạng thái kép."
        className="mb-6"
        right={hasFilters ? <Badge tone="teal">Đang áp dụng bộ lọc</Badge> : undefined}
      >
        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tìm kiếm">
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã đơn, sản phẩm..." />
          </Field>
          <Field label="TT Thanh toán">
            <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {PAYMENT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{ORDER_PAYMENT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="TT Thực hiện">
            <select className="input" value={fulfillmentStatus} onChange={(e) => setFulfillmentStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {FULFILLMENT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{ORDER_FULFILLMENT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col gap-2 justify-end pb-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={needsAction} onChange={(e) => setNeedsAction(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand-600" />
              Chỉ đơn cần xử lý
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setQ(""); setPaymentStatus(""); setFulfillmentStatus(""); setNeedsAction(false); }}>
                Xóa lọc
              </button>
            </div>
          </div>
        </form>
      </Panel>

      {/* Bảng đơn */}
      <Panel
        title="Danh sách đơn"
        right={<span className="text-sm text-muted"><strong className="text-ink">{filtered.length}</strong> đơn gần nhất</span>}
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Mã đơn</th>
                <th className="th">Vị trí</th>
                <th className="th">Món ăn / Đồ uống</th>
                <th className="th">Tổng tiền</th>
                <th className="th">Hình thức</th>
                <th className="th">Người tạo</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thời gian</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr><td colSpan={9}><EmptyState>Không có đơn phù hợp bộ lọc hiện tại.</EmptyState></td></tr>
              )}
              {filtered.map((order) => {
                const attention = order.paymentStatus === "PAYMENT_REVIEW" || order.fulfillmentStatus === "QUEUED";
                return (
                  <tr key={order.id} className={attention ? "bg-red-50/50" : "hover:bg-surface-soft transition-colors"}>
                    <td className="td font-bold text-ink whitespace-nowrap">
                      {order.code}
                    </td>
                    <td className="td whitespace-nowrap">
                      <span className="inline-flex whitespace-nowrap rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
                        {order.customerInput || "Bàn tự do"}
                      </span>
                    </td>
                    <td className="td">
                      <strong className="text-sm text-ink">{order.productName}</strong>
                      <span className="ml-2 text-xs font-semibold text-slate-500">x{order.quantity}</span>
                    </td>
                    <td className="td font-bold tabular-nums text-slate-900">
                      {formatVnd(order.amountVnd)}
                    </td>
                    <td className="td text-xs font-medium text-slate-600">
                      {order.paymentMethod === "cash" ? "Tiền mặt" : "QR Code"}
                    </td>
                    <td className="td">
                      <strong className="text-xs font-semibold text-slate-800">@{order.user.username || order.user.telegramId}</strong>
                      <small className="block text-[11px] text-muted">{order.user.firstName} {order.user.lastName}</small>
                    </td>
                    <td className="td whitespace-nowrap">
                      <Badge tone={orderPaymentTone(order.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
                    </td>
                    <td className="td text-xs whitespace-nowrap">
                      <span className="block font-medium text-slate-700">{formatDate(order.createdAt)}</span>
                      <span className="block text-[11px] text-slate-400">{formatTime(order.createdAt)}</span>
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {order.paymentStatus === "PAYMENT_REVIEW" && (
                          <button type="button" className="btn-ghost text-xs px-2.5 py-1" onClick={() => resolveReview(order)}>Bỏ kiểm tra</button>
                        )}
                        {order.fulfillmentStatus === "QUEUED" && (
                          <button type="button" className="btn text-xs px-2.5 py-1" onClick={() => { setCompleteOrder(order); setCompleteNote(order.adminNote ?? ""); }}>
                            Xử lý xong
                          </button>
                        )}
                        {(order.paymentStatus === "PENDING" || order.paymentStatus === "UNPAID") && (
                          <button type="button" className="btn-danger text-xs px-2.5 py-1" onClick={() => cancelOrder(order)}>Hủy đơn</button>
                        )}
                        {order.paymentStatus !== "PAYMENT_REVIEW" && order.fulfillmentStatus !== "QUEUED" && order.paymentStatus !== "PENDING" && order.paymentStatus !== "UNPAID" && (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Modal gắn kiểm tra */}
      <Modal
        open={reviewOrder !== null}
        onClose={() => setReviewOrder(null)}
        eyebrow="KIỂM TRA ĐƠN"
        title={`Gắn cờ cho ${reviewOrder?.code ?? ""}`}
        subtitle="Đơn sẽ nổi bật trong danh sách cần xử lý."
      >
        <form onSubmit={saveReview} className="space-y-4">
          <Field label="Lý do cần xử lý">
            <input className="input" value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Ví dụ: khách chuyển khoản thiếu" required />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReviewOrder(null)}>Hủy</button>
            <button type="submit" className="btn">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal hoàn tất dịch vụ */}
      <Modal
        open={completeOrder !== null}
        onClose={() => setCompleteOrder(null)}
        eyebrow="XỬ LÝ ĐƠN"
        title={`Hoàn tất đơn ${completeOrder?.code ?? ""}`}
        subtitle="Xác nhận đã xử lý xong và chuyển trạng thái giao hàng."
      >
        <form onSubmit={completeService} className="space-y-4">
          <Field label="Ghi chú (tuỳ chọn)">
            <input className="input" value={completeNote} onChange={(e) => setCompleteNote(e.target.value)} placeholder="Ví dụ: Đã đóng gói cẩn thận" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCompleteOrder(null)}>Hủy</button>
            <button type="submit" className="btn">Hoàn tất</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}
