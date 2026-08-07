"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PageHeader,
  Panel,
  Badge,
  EmptyState,
  Field,
  Modal,
  orderPaymentTone,
  orderFulfillmentTone,
  type Tone,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDateTime } from "@/lib/format";
import {
  orderDetails,
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUS_LABEL,
  TIMELINE_STATUS_LABEL,
  type OrderDetail,
  type OrderFulfillmentStatus,
  type OrderTimelineEvent,
} from "@/lib/data";

const FULFILLMENT_OPTIONS = Object.keys(ORDER_FULFILLMENT_STATUS_LABEL) as OrderFulfillmentStatus[];

/* Màu badge cho từng mốc timeline */
function timelineTone(status: string): Tone {
  switch (status) {
    case "ORDER_CREATED":
      return "gray";
    case "CANCELLED":
      return "red";
    case "REFUNDED":
      return "blue";
    case "PAID":
      return "green";
    case "UNDERPAID":
    case "OVERPAID":
      return "red";
    case "PENDING_PAYMENT":
      return "amber";
    default:
      return orderFulfillmentTone(status);
  }
}

/* QR giả (placeholder) sinh từ mã đơn để mỗi đơn có hoa văn riêng */
function FakeQR({ seed }: { seed: string }) {
  const size = 21;
  const cells: { x: number; y: number; dark: boolean }[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      if (finder) {
        const border = x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        cells.push({ x, y, dark: border });
        continue;
      }
      hash = (hash * 1103515245 + 12345) >>> 0;
      cells.push({ x, y, dark: hash % 5 !== 0 });
    }
  }

  return (
    <div className="mx-auto w-fit rounded-2xl border-8 border-white bg-white p-2 shadow-xl shadow-slate-900/10 ring-1 ring-line">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44" role="img" aria-label="Mã QR thanh toán giả lập">
        <rect width={size} height={size} fill="#fff" />
        {cells.map((c) =>
          c.dark ? (
            <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="#0b1526" />
          ) : null
        )}
      </svg>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId ?? "";
  // key={orderId} ép remount khi điều hướng client-side giữa các mã đơn → state luôn đúng đơn đang xem
  return <OrderDetailView key={orderId} orderId={orderId} />;
}

function OrderDetailView({ orderId }: { orderId: string }) {
  const toast = useToast();

  const [detail, setDetail] = useState<OrderDetail | null>(
    () => orderDetails.find((d) => d.code === orderId) ?? null
  );

  // Modals
  const [cashOpen, setCashOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const [refundBy, setRefundBy] = useState("Admin");
  const [overrideStatus, setOverrideStatus] = useState<OrderFulfillmentStatus | "">("");

  if (!detail) {
    return (
      <div>
        <PageHeader title="Không tìm thấy đơn">
          <Link href="/orders" className="btn-ghost">
            ← Quay lại danh sách đơn
          </Link>
        </PageHeader>
        <Panel>
          <EmptyState>
            Không có đơn hàng nào khớp mã <strong className="text-ink">{orderId}</strong>. Vui lòng kiểm tra lại mã đơn.
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const canRefund = ["PAID", "OVERPAID", "UNDERPAID"].includes(detail.paymentStatus);
  const isUnpaid = detail.paymentStatus === "UNPAID";

  const pushEvent = (event: OrderTimelineEvent) =>
    setDetail((d) => (d ? { ...d, timeline: [...d.timeline, event] } : d));

  const nowIso = () => new Date().toISOString();

  /* ── Xác nhận tiền mặt ── */
  const confirmCash = (e: FormEvent) => {
    e.preventDefault();
    pushEvent({
      id: `${detail.id}-cash-${Date.now()}`,
      status: "PAID",
      label: "Đã thu tiền mặt",
      at: nowIso(),
      by: "Admin",
      note: `Thu ${formatVnd(detail.totalVnd)} tại quầy`,
    });
    setDetail((d) => (d ? { ...d, paymentStatus: "PAID", paidAmount: d.totalVnd } : d));
    toast.push(`Đã xác nhận thu tiền mặt ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`, "success");
    setCashOpen(false);
  };

  /* ── QR đã nhận tiền ── */
  const confirmQrPaid = () => {
    pushEvent({
      id: `${detail.id}-qr-${Date.now()}`,
      status: "PAID",
      label: "Thanh toán thành công (QR)",
      at: nowIso(),
      by: "Admin",
      note: `Nhận chuyển khoản ${formatVnd(detail.totalVnd)}`,
    });
    setDetail((d) => (d ? { ...d, paymentStatus: "PAID", paidAmount: d.totalVnd } : d));
    toast.push(`Đã ghi nhận thanh toán QR ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`, "success");
    setQrOpen(false);
  };

  /* ── Xác nhận đã thu đủ cho đơn thiếu tiền ── */
  const confirmUnderpaidAsPaid = () => {
    const diff = detail.totalVnd - detail.paidAmount;
    pushEvent({
      id: `${detail.id}-underpaid-paid-${Date.now()}`,
      status: "PAID",
      label: "Đã thu đủ tiền",
      at: nowIso(),
      by: "Admin",
      note: `Thu bổ sung ${formatVnd(diff)} còn thiếu`,
    });
    setDetail((d) => (d ? { ...d, paymentStatus: "PAID", paidAmount: d.totalVnd } : d));
    toast.push(`Đã xác nhận thu đủ ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`, "success");
  };

  /* ── Hoàn tiền (Refund) ── */
  const submitRefund = (e: FormEvent) => {
    e.preventDefault();
    const amount = Math.min(Math.max(0, refundAmount || 0), detail.paidAmount || detail.totalVnd);
    if (amount <= 0) {
      toast.push("Số tiền hoàn phải lớn hơn 0.", "error");
      return;
    }
    pushEvent({
      id: `${detail.id}-refund-${Date.now()}`,
      status: "REFUNDED",
      label: `Hoàn tiền ${formatVnd(amount)}`,
      at: nowIso(),
      by: refundBy || "Admin",
      note: refundReason,
    });
    setDetail((d) => (d ? { ...d, paymentStatus: "REFUNDED", paidAmount: Math.max(0, d.paidAmount - amount) } : d));
    toast.push(`Đã hoàn tiền ${formatVnd(amount)} cho đơn ${detail.code}.`, "success");
    setRefundOpen(false);
    setRefundAmount(0);
    setRefundReason("");
  };

  /* ── Đổi trạng thái thực hiện ── */
  const applyStatus = () => {
    if (!overrideStatus || overrideStatus === detail.fulfillmentStatus) return;
    const label = ORDER_FULFILLMENT_STATUS_LABEL[overrideStatus];
    pushEvent({
      id: `${detail.id}-st-${Date.now()}`,
      status: overrideStatus,
      label: `Chuyển trạng thái → ${label}`,
      at: nowIso(),
      by: "Admin",
      note: "Cập nhật thủ công từ Web Admin",
    });
    setDetail((d) => (d ? { ...d, fulfillmentStatus: overrideStatus } : d));
    toast.push(`Đã đổi trạng thái đơn ${detail.code} sang “${label}”.`, "success");
    setOverrideStatus("");
  };

  return (
    <div>
      <PageHeader
        title={
          <>
            Đơn <span className="font-mono text-brand-700">{detail.code}</span>
          </>
        }
        description={`Tạo lúc ${formatDateTime(detail.createdAt)} · ${detail.customerInput || "Không ghi vị trí"}`}
      >
        <Link href="/orders" className="btn-ghost">
          ← Quay lại
        </Link>
      </PageHeader>

      {/* Tóm tắt đơn */}
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={orderPaymentTone(detail.paymentStatus)}>
              TT thanh toán: {ORDER_PAYMENT_STATUS_LABEL[detail.paymentStatus]}
            </Badge>
            <Badge tone={orderFulfillmentTone(detail.fulfillmentStatus)}>
              TT thực hiện: {ORDER_FULFILLMENT_STATUS_LABEL[detail.fulfillmentStatus]}
            </Badge>
            <Badge tone={detail.paymentMethod === "qr" ? "teal" : "amber"}>
              {detail.paymentMethod === "qr" ? "Chuyển khoản QR" : "Tiền mặt"}
            </Badge>
          </div>
          <div className="text-right">
            <span className="block text-xs font-medium text-muted">Tổng tiền</span>
            <strong className="block text-2xl font-extrabold tabular-nums tracking-tight text-ink">
              {formatVnd(detail.totalVnd)}
            </strong>
            {detail.discountVnd > 0 && (
              <small className="text-xs text-emerald-600">Đã giảm {formatVnd(detail.discountVnd)}</small>
            )}
          </div>
        </div>
      </Panel>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        {/* Cột chính */}
        <div className="flex flex-col space-y-6 xl:col-span-2">
          {/* Chi tiết món */}
          <Panel title="Chi tiết món" subtitle="Giá và tên được lưu snapshot tại thời điểm đặt hàng.">
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Món</th>
                    <th className="th text-right">Đơn giá</th>
                    <th className="th text-center">SL</th>
                    <th className="th text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {detail.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-soft transition-colors">
                      <td className="td">
                        <strong className="block text-sm text-ink">{item.productName}</strong>
                        {item.nameEn && <small className="text-xs text-muted">{item.nameEn}</small>}
                      </td>
                      <td className="td text-right tabular-nums text-slate-700">{formatVnd(item.unitPriceVnd)}</td>
                      <td className="td text-center font-bold tabular-nums text-ink">×{item.quantity}</td>
                      <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(item.lineTotalVnd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td colSpan={3} className="td text-right text-xs text-muted">
                      Tạm tính
                    </td>
                    <td className="td text-right tabular-nums text-slate-700">{formatVnd(detail.subtotalVnd)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="td text-right text-xs text-muted">
                      Giảm giá
                    </td>
                    <td className="td text-right tabular-nums text-emerald-600">−{formatVnd(detail.discountVnd)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="td text-right text-sm font-bold text-ink">
                      Tổng cộng
                    </td>
                    <td className="td text-right text-base font-extrabold tabular-nums text-ink">{formatVnd(detail.totalVnd)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {/* Timeline */}
          <Panel title="Timeline" subtitle="Lịch sử trạng thái của đơn theo thời gian." className="flex-1">
            <ol className="relative space-y-0 border-l border-line pl-6">
              {detail.timeline.map((event) => (
                <li key={event.id} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                      event.status === "CANCELLED"
                        ? "bg-red-500"
                        : event.status === "REFUNDED"
                          ? "bg-blue-500"
                          : event.status === "ORDER_CREATED"
                            ? "bg-slate-400"
                            : "bg-brand-500"
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={timelineTone(event.status)}>{TIMELINE_STATUS_LABEL[event.status]}</Badge>
                      <strong className="text-sm font-bold text-ink">{event.label}</strong>
                    </div>
                    <time className="text-xs tabular-nums text-muted">{formatDateTime(event.at)}</time>
                  </div>
                  {(event.by || event.note) && (
                    <p className="mt-1 text-xs text-muted">
                      {event.by && <span className="font-semibold text-slate-600">{event.by}</span>}
                      {event.note && <span>{event.by ? " · " : ""}{event.note}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {/* Cột phụ */}
        <div className="flex flex-col space-y-6">
          {/* Thao tác */}
          <Panel title="Thao tác">
            <div className="space-y-2.5">
              {detail.paymentMethod === "cash" && isUnpaid && (
                <button type="button" className="btn w-full" onClick={() => setCashOpen(true)}>
                  💵 Xác nhận tiền mặt
                </button>
              )}
              {detail.paymentMethod === "qr" && isUnpaid && (
                <button type="button" className="btn w-full" onClick={() => setQrOpen(true)}>
                  📱 Khởi tạo QR
                </button>
              )}
              {detail.paymentStatus === "UNDERPAID" && (
                <>
                  <button type="button" className="btn w-full" onClick={confirmUnderpaidAsPaid}>
                    ✓ Xác nhận đã thu đủ (+{formatVnd(detail.totalVnd - detail.paidAmount)})
                  </button>
                  <button
                    type="button"
                    className="btn-danger w-full"
                    onClick={() => {
                      setRefundAmount(detail.paidAmount);
                      setRefundReason("Khách chuyển thiếu tiền và muốn hủy đơn/hoàn tiền");
                      setRefundOpen(true);
                    }}
                  >
                    ↺ Hoàn lại {formatVnd(detail.paidAmount)} cho khách
                  </button>
                </>
              )}
              {canRefund && detail.paymentStatus !== "UNDERPAID" && (
                <button
                  type="button"
                  className="btn-danger w-full"
                  onClick={() => {
                    setRefundAmount(Math.min(detail.totalVnd, detail.paidAmount || detail.totalVnd));
                    setRefundReason("");
                    setRefundOpen(true);
                  }}
                >
                  ↺ Hoàn tiền
                </button>
              )}
              {!canRefund && !isUnpaid && detail.paymentStatus !== "REFUNDED" && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                  Đơn ở trạng thái <strong className="text-ink">{ORDER_PAYMENT_STATUS_LABEL[detail.paymentStatus]}</strong> — không có thao tác thu/hoàn tiền.
                </p>
              )}
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <Field label="Đổi trạng thái thực hiện">
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as OrderFulfillmentStatus)}
                  >
                    <option value="">Chọn trạng thái…</option>
                    {FULFILLMENT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_FULFILLMENT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    disabled={!overrideStatus || overrideStatus === detail.fulfillmentStatus}
                    onClick={applyStatus}
                  >
                    Áp dụng
                  </button>
                </div>
              </Field>
            </div>
          </Panel>

          {/* Thanh toán */}
          <Panel title="Thanh toán">
            <dl className="divide-y divide-line-soft">
              <DetailRow label="Phương thức">
                {detail.paymentMethod === "qr" ? "Chuyển khoản QR" : "Tiền mặt"}
              </DetailRow>
              <DetailRow label="Đã thanh toán">
                <span className={detail.paidAmount >= detail.totalVnd && detail.paidAmount > 0 ? "text-emerald-600" : detail.paidAmount > 0 ? "text-amber-600" : "text-slate-500"}>
                  {formatVnd(detail.paidAmount)}
                </span>
              </DetailRow>
              <DetailRow label="Trạng thái">
                <Badge tone={orderPaymentTone(detail.paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[detail.paymentStatus]}</Badge>
              </DetailRow>
              {detail.paymentStatus === "UNDERPAID" && detail.totalVnd > detail.paidAmount && (
                <DetailRow label="Còn thiếu">
                  <span className="text-red-600">{formatVnd(detail.totalVnd - detail.paidAmount)}</span>
                </DetailRow>
              )}
            </dl>
          </Panel>

          {/* Khách hàng */}
          <Panel title="Khách hàng" className="flex-1">
            <dl className="divide-y divide-line-soft">
              <DetailRow label="Họ tên">
                {detail.user.firstName} {detail.user.lastName}
              </DetailRow>
              <DetailRow label="Telegram">
                <span className="font-mono text-xs">{detail.user.telegramId}</span>
              </DetailRow>
              <DetailRow label="Username">@{detail.user.username || "—"}</DetailRow>
              <DetailRow label="Vị trí">{detail.customerInput || "—"}</DetailRow>
              <DetailRow label="Hạn chờ thanh toán">{detail.expiresAt ? formatDateTime(detail.expiresAt) : "—"}</DetailRow>
              {detail.deliveredAt && (
                <DetailRow label="Đã giao lúc">{formatDateTime(detail.deliveredAt)}</DetailRow>
              )}
            </dl>
          </Panel>
        </div>
      </div>

      {/* Modal xác nhận tiền mặt */}
      <Modal
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        eyebrow="THU TIỀN MẶT"
        title={`Xác nhận đã thu ${formatVnd(detail.totalVnd)}`}
        subtitle={`Đơn ${detail.code} · ${detail.customerInput || "Không ghi vị trí"}`}
      >
        <form onSubmit={confirmCash} className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Xác nhận bạn đã nhận đủ <strong>{formatVnd(detail.totalVnd)}</strong> tiền mặt từ khách hàng. Đơn sẽ được chuyển sang trạng thái <strong>“Đã thanh toán”</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCashOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn">
              Xác nhận đã thu tiền
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal khởi tạo QR */}
      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        eyebrow="THANH TOÁN QR"
        title={`Chuyển khoản ${formatVnd(detail.totalVnd)}`}
        subtitle="Khách quét mã và chuyển khoản đúng nội dung bên dưới."
      >
        <div className="space-y-4">
          <FakeQR seed={detail.code} />
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
            <span className="block text-xs text-muted">Nội dung chuyển khoản</span>
            <strong className="mt-0.5 block font-mono text-lg font-extrabold tracking-widest text-ink">{detail.code}</strong>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setQrOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn" onClick={confirmQrPaid}>
              Đã nhận tiền (PAID)
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal hoàn tiền */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        eyebrow="HOÀN TIỀN"
        title={`Hoàn tiền cho đơn ${detail.code}`}
        subtitle="Chỉ khả dụng với đơn đã thanh toán (PAID / thiếu / thừa)."
      >
        <form onSubmit={submitRefund} className="space-y-4">
          <Field label="Số tiền hoàn" hint={`Số dư đã thanh toán: ${formatVnd(detail.paidAmount)}`}>
            <input
              className="input"
              type="number"
              min={0}
              max={detail.paidAmount || detail.totalVnd}
              value={refundAmount || ""}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Lý do hoàn tiền (bắt buộc)">
            <textarea
              className="input min-h-[90px] resize-y"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Ví dụ: khách không hài lòng, hủy đơn..."
              required
            />
          </Field>
          <Field label="Người xác nhận">
            <input className="input" value={refundBy} onChange={(e) => setRefundBy(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setRefundOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-danger">
              Xác nhận hoàn tiền
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
