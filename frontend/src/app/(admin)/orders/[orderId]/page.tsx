"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PageHeader,
  Panel,
  Badge,
  EmptyState,
  Field,
  Modal,
  PageLoading,
  orderPaymentTone,
  orderFulfillmentTone,
  type Tone,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatDateTime } from "@/lib/format";
import {
  getOrder,
  getOrderPayments,
  getCurrentUser,
  getMenuItems,
  getCategories,
  confirmCash,
  initQrPayment,
  refundOrder,
  cancelOrder,
  overrideOrderStatus,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  type ApiOrder,
  type ApiOrderPaymentRecord,
  type ApiUser,
  type ApiMenuItem,
  type ApiCategory,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import {
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUS_LABEL,
  type OrderFulfillmentStatus,
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
    case "REVIEW":
      return "red";
    case "PENDING_PAYMENT":
      return "amber";
    default:
      return orderFulfillmentTone(status);
  }
}

/* Tên hiển thị cho từng mốc timeline từ newStatus + domain */
function timelineLabel(statusDomain: string, newStatus: string): string {
  if (statusDomain === "PAYMENT") {
    return ORDER_PAYMENT_STATUS_LABEL[newStatus as keyof typeof ORDER_PAYMENT_STATUS_LABEL] ?? newStatus;
  }
  return ORDER_FULFILLMENT_STATUS_LABEL[newStatus as keyof typeof ORDER_FULFILLMENT_STATUS_LABEL] ?? newStatus;
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

  const loadOrder = useCallback(async () => {
    const [order, mePayload, paymentsPayload] = await Promise.all([
      getOrder(orderId),
      getCurrentUser().catch(() => null),
      getOrderPayments(orderId).catch(() => ({ data: [] as ApiOrderPaymentRecord[] })),
    ]);
    return { order, me: mePayload?.data ?? null, payments: paymentsPayload.data };
  }, [orderId]);

  const { data, loading, error, reload } = useApiData(loadOrder, {
    order: null as ApiOrder | null,
    me: null as ApiUser | null,
    payments: [] as ApiOrderPaymentRecord[],
  });
  const { order, me, payments } = data;

  // Dữ liệu thực đơn để thêm món
  const loadMenu = useCallback(async () => {
    const [itemsPayload, categoriesPayload] = await Promise.all([
      getMenuItems(500),
      getCategories(),
    ]);
    return { items: itemsPayload.data, categories: categoriesPayload.data };
  }, []);
  const { data: menu } = useApiData(loadMenu, {
    items: [] as ApiMenuItem[],
    categories: [] as ApiCategory[],
  });
  const availableItems = useMemo(() => menu.items.filter((item) => item.isAvailable), [menu.items]);

  // Modals
  const [cashOpen, setCashOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrContent, setQrContent] = useState("");
  const [qrAmount, setQrAmount] = useState("0");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<OrderFulfillmentStatus | "">("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Sửa món
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemNote, setAddItemNote] = useState("");
  const [editItem, setEditItem] = useState<{ id: string; name: string; quantity: number; note: string } | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState("");

  const totalVnd = Number(order?.totalAmount ?? 0);
  const paidAmount = Number(order?.payment?.receivedAmount ?? 0);
  const expectedAmount = Number(order?.payment?.expectedAmount ?? 0);
  const paymentMethod = order?.paymentMethod === "CASH" ? "cash" : "qr";
  const paymentStatus = order?.paymentStatus === "REVIEW" ? "PAYMENT_REVIEW" : (order?.paymentStatus ?? "UNPAID");
  const isUnpaid = order?.paymentStatus === "UNPAID" && order?.fulfillmentStatus === "PENDING_PAYMENT";
  const canEditItems = order?.paymentStatus === "UNPAID" && order?.fulfillmentStatus === "PENDING_PAYMENT";
  const canRefund = ["PAID", "OVERPAID", "UNDERPAID"].includes(order?.paymentStatus ?? "");
  const canCancel = ["PENDING_PAYMENT", "QUEUED", "PREPARING"].includes(order?.fulfillmentStatus ?? "");

  const timeline = useMemo(() => {
    if (!order) return [];
    const events = order.timeline ?? [];
    // Thêm mốc tạo đơn nếu chưa có
    const hasCreated = events.some((e) => e.newStatus === "ORDER_CREATED");
    const created = hasCreated
      ? []
      : [{
          id: `${order.id}-created`,
          status: "ORDER_CREATED",
          label: "Tạo đơn",
          at: order.createdAt,
          by: order.creator?.fullName ?? "Khách hàng",
          note: order.customerNote ?? undefined,
        }];
    const mapped = events.map((e) => ({
      id: e.id,
      status: e.newStatus,
      label: timelineLabel(e.statusDomain, e.newStatus),
      at: e.createdAt,
      by: e.changedByUserId && e.changedByUserId === order.createdByUserId
        ? order.creator?.fullName ?? "Người tạo"
        : e.changedByUserId
          ? "Admin"
          : "Hệ thống",
      note: e.reason ?? undefined,
    }));
    return [...created, ...mapped];
  }, [order]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      toast.push(success, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác.", "error");
    } finally {
      setBusy(false);
    }
  };

  const currentUserId = me?.id;

  /* ── Xác nhận tiền mặt ── */
  const confirmCashSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!order || !currentUserId) {
      toast.push("Không xác định được tài khoản đang đăng nhập.", "error");
      return;
    }
    void act(
      () => confirmCash(order.id, { confirmedByUserId: currentUserId, amount: totalVnd }),
      `Đã xác nhận thu tiền mặt ${formatVnd(totalVnd)} cho đơn ${order.orderCode}.`,
    );
    setCashOpen(false);
  };

  /* ── Khởi tạo QR ── */
  const openQr = async () => {
    if (!order || !currentUserId) {
      toast.push("Không xác định được tài khoản đang đăng nhập.", "error");
      return;
    }
    setQrOpen(true);
    setQrContent("Đang khởi tạo...");
    setQrAmount("0");
    try {
      const result = await initQrPayment(order.id, { requestedByUserId: currentUserId });
      setQrContent(result.transferContent);
      setQrAmount(result.amount);
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không khởi tạo được QR.", "error");
      setQrOpen(false);
    }
  };

  /* ── Đã nhận tiền QR (PAID) ── */
  const confirmQrPaid = () => {
    if (!order) return;
    void act(
      () => overrideOrderStatus(order.id, { domain: "PAYMENT", status: "PAID", reason: "Admin xác nhận đã nhận chuyển khoản QR" }),
      `Đã ghi nhận thanh toán QR cho đơn ${order.orderCode}.`,
    );
    setQrOpen(false);
  };

  /* ── Xác nhận đã thu đủ cho đơn thiếu tiền ── */
  const confirmUnderpaidAsPaid = () => {
    if (!order) return;
    void act(
      () => overrideOrderStatus(order.id, { domain: "PAYMENT", status: "PAID", reason: "Admin xác nhận đã thu đủ số tiền còn thiếu" }),
      `Đã xác nhận thu đủ ${formatVnd(totalVnd)} cho đơn ${order.orderCode}.`,
    );
  };

  /* ── Hoàn tiền (Refund) ── */
  const submitRefund = (e: FormEvent) => {
    e.preventDefault();
    if (!order || !currentUserId) return;
    const amount = Math.min(Math.max(0, refundAmount || 0), paidAmount || totalVnd);
    if (amount <= 0) {
      toast.push("Số tiền hoàn phải lớn hơn 0.", "error");
      return;
    }
    if (!refundReason.trim()) {
      toast.push("Vui lòng nhập lý do hoàn tiền.", "error");
      return;
    }
    void act(
      () => refundOrder(order.id, { refundedByUserId: currentUserId, reason: refundReason.trim(), amount }),
      `Đã hoàn tiền ${formatVnd(amount)} cho đơn ${order.orderCode}.`,
    );
    setRefundOpen(false);
    setRefundAmount(0);
    setRefundReason("");
  };

  /* ── Hủy đơn ── */
  const submitCancel = (e: FormEvent) => {
    e.preventDefault();
    if (!order || !currentUserId) return;
    if (!cancelReason.trim()) {
      toast.push("Vui lòng nhập lý do hủy đơn.", "error");
      return;
    }
    void act(
      () => cancelOrder(order.id, { reason: cancelReason.trim(), requesterId: currentUserId }),
      `Đã hủy đơn ${order.orderCode}.`,
    );
    setCancelOpen(false);
    setCancelReason("");
  };

  /* ── Đổi trạng thái thực hiện ── */
  const applyStatus = () => {
    if (!order || !overrideStatus || overrideStatus === order.fulfillmentStatus) return;
    const label = ORDER_FULFILLMENT_STATUS_LABEL[overrideStatus];
    void act(
      () => overrideOrderStatus(order.id, { domain: "FULFILLMENT", status: overrideStatus, reason: "Cập nhật thủ công từ Web Admin" }),
      `Đã đổi trạng thái đơn ${order.orderCode} sang “${label}”.`,
    );
    setOverrideStatus("");
  };

  /* ── Thêm món ── */
  const submitAddItem = (e: FormEvent) => {
    e.preventDefault();
    if (!order || !addItemId) {
      toast.push("Vui lòng chọn món cần thêm.", "error");
      return;
    }
    void act(
      () => addOrderItem(order.id, {
        menuItemId: addItemId,
        quantity: Math.max(1, Math.round(addItemQty) || 1),
        note: addItemNote.trim() || undefined,
      }),
      "Đã thêm món vào đơn.",
    );
    setAddItemOpen(false);
    setAddItemId("");
    setAddItemQty(1);
    setAddItemNote("");
  };

  /* ── Sửa / Xóa món ── */
  const submitEditItem = (e: FormEvent) => {
    e.preventDefault();
    if (!order || !editItem) return;
    void act(
      () => updateOrderItem(order.id, editItem.id, {
        quantity: Math.max(1, Math.round(editQty) || 1),
        note: editNote.trim() || null,
      }),
      "Đã cập nhật món.",
    );
    setEditItem(null);
  };

  const removeItem = (itemId: string, itemName: string) => {
    if (!order) return;
    if (order.items.length <= 1) {
      toast.push("Không thể xóa món cuối cùng của đơn.", "error");
      return;
    }
    if (!confirm(`Xóa món "${itemName}" khỏi đơn?`)) return;
    void act(() => deleteOrderItem(order.id, itemId), `Đã xóa món "${itemName}".`);
  };

  if (loading && !order) {
    return <PageLoading label="Đang tải chi tiết đơn hàng..." subText="Đang đồng bộ snapshot món ăn và trạng thái thanh toán..." />;
  }

  if (!order) {
    return (
      <div>
        <PageHeader title="Không tìm thấy đơn">
          <Link href="/orders" className="btn-ghost">
            ← Quay lại danh sách đơn
          </Link>
        </PageHeader>
        <Panel>
          <EmptyState>
            {error ? error : `Không có đơn hàng nào khớp mã ${orderId}. Vui lòng kiểm tra lại mã đơn.`}
          </EmptyState>
        </Panel>
      </div>
    );
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader
        title={
          <>
            Đơn <span className="font-mono text-brand-700">{order.orderCode}</span>
          </>
        }
        description={`Tạo lúc ${formatDateTime(order.createdAt)} · ${order.customerNote || "Không ghi vị trí"}`}
      >
        <Link href="/orders" className="btn-ghost">
          ← Quay lại
        </Link>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Tóm tắt đơn */}
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={orderPaymentTone(paymentStatus)}>
              TT thanh toán: {ORDER_PAYMENT_STATUS_LABEL[paymentStatus]}
            </Badge>
            <Badge tone={orderFulfillmentTone(order.fulfillmentStatus)}>
              TT thực hiện: {ORDER_FULFILLMENT_STATUS_LABEL[order.fulfillmentStatus]}
            </Badge>
            <Badge tone={paymentMethod === "qr" ? "teal" : "amber"}>
              {paymentMethod === "qr" ? "Chuyển khoản QR" : "Tiền mặt"}
            </Badge>
          </div>
          <div className="text-right">
            <span className="block text-xs font-medium text-muted">Tổng tiền</span>
            <strong className="block text-2xl font-extrabold tabular-nums tracking-tight text-ink">
              {formatVnd(totalVnd)}
            </strong>
          </div>
        </div>
      </Panel>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        {/* Cột chính */}
        <div className="flex flex-col space-y-6 xl:col-span-2">
          {/* Chi tiết món */}
          <Panel
            title="Chi tiết món"
            subtitle="Giá và tên được lưu snapshot tại thời điểm đặt hàng."
            right={
              canEditItems ? (
                <button type="button" className="btn text-xs" onClick={() => setAddItemOpen(true)}>+ Thêm món</button>
              ) : undefined
            }
          >
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Món</th>
                    <th className="th text-right">Đơn giá</th>
                    <th className="th text-center">SL</th>
                    <th className="th text-right">Thành tiền</th>
                    {canEditItems && <th className="th text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-soft transition-colors">
                      <td className="td">
                        <strong className="block text-sm text-ink">{item.itemName}</strong>
                        {item.note && <small className="text-xs text-muted">📝 {item.note}</small>}
                      </td>
                      <td className="td text-right tabular-nums text-slate-700">{formatVnd(Number(item.unitPrice))}</td>
                      <td className="td text-center font-bold tabular-nums text-ink">×{item.quantity}</td>
                      <td className="td text-right font-bold tabular-nums text-ink">
                        {formatVnd(Number(item.unitPrice) * item.quantity)}
                      </td>
                      {canEditItems && (
                        <td className="td">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              className="btn-ghost text-xs px-3 py-1 rounded-full"
                              onClick={() => {
                                setEditItem({ id: item.id, name: item.itemName, quantity: item.quantity, note: item.note ?? "" });
                                setEditQty(item.quantity);
                                setEditNote(item.note ?? "");
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn-danger text-xs px-3 py-1 rounded-full"
                              disabled={order.items.length <= 1}
                              title={order.items.length <= 1 ? "Không thể xóa món cuối cùng" : undefined}
                              onClick={() => removeItem(item.id, item.itemName)}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td colSpan={canEditItems ? 4 : 3} className="td text-right text-xs text-muted">
                      Tổng cộng
                    </td>
                    <td className="td text-right text-base font-extrabold tabular-nums text-ink">{formatVnd(totalVnd)}</td>
                    {canEditItems && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {/* Timeline */}
          <Panel title="Timeline" subtitle="Lịch sử trạng thái của đơn theo thời gian." className="flex-1">
            <ol className="relative space-y-0 border-l border-line pl-6">
              {timeline.map((event) => (
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
                      <Badge tone={timelineTone(event.status)}>{event.label}</Badge>
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
              {paymentMethod === "cash" && isUnpaid && (
                <button type="button" className="btn w-full" disabled={busy} onClick={() => setCashOpen(true)}>
                  💵 Xác nhận tiền mặt
                </button>
              )}
              {paymentMethod === "qr" && isUnpaid && (
                <button type="button" className="btn w-full" disabled={busy} onClick={() => void openQr()}>
                  📱 Khởi tạo QR
                </button>
              )}
              {order.paymentStatus === "UNDERPAID" && (
                <>
                  <button type="button" className="btn w-full" disabled={busy} onClick={confirmUnderpaidAsPaid}>
                    ✓ Xác nhận đã thu đủ (+{formatVnd(Math.max(0, expectedAmount - paidAmount))})
                  </button>
                  <button
                    type="button"
                    className="btn-danger w-full"
                    disabled={busy}
                    onClick={() => {
                      setRefundAmount(paidAmount);
                      setRefundReason("Khách chuyển thiếu tiền và muốn hủy đơn/hoàn tiền");
                      setRefundOpen(true);
                    }}
                  >
                    ↺ Hoàn lại {formatVnd(paidAmount)} cho khách
                  </button>
                </>
              )}
              {canRefund && order.paymentStatus !== "UNDERPAID" && (
                <button
                  type="button"
                  className="btn-danger w-full"
                  disabled={busy}
                  onClick={() => {
                    setRefundAmount(Math.min(totalVnd, paidAmount || totalVnd));
                    setRefundReason("");
                    setRefundOpen(true);
                  }}
                >
                  ↺ Hoàn tiền
                </button>
              )}
              {canCancel && (
                <button type="button" className="btn-danger w-full" disabled={busy} onClick={() => setCancelOpen(true)}>
                  ✕ Hủy đơn
                </button>
              )}
              {!canRefund && !isUnpaid && (paymentStatus as string) !== "REFUNDED" && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                  Đơn ở trạng thái <strong className="text-ink">{ORDER_PAYMENT_STATUS_LABEL[paymentStatus]}</strong> — không có thao tác thu/hoàn tiền.
                </p>
              )}
            </div>

            {order.fulfillmentStatus !== "DELIVERED" && order.fulfillmentStatus !== "CANCELLED" && (
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
                      disabled={!overrideStatus || overrideStatus === order.fulfillmentStatus || busy}
                      onClick={applyStatus}
                    >
                      Áp dụng
                    </button>
                  </div>
                </Field>
              </div>
            )}
          </Panel>

          {/* Thanh toán */}
          <Panel title="Thanh toán">
            <dl className="divide-y divide-line-soft">
              <DetailRow label="Phương thức">
                {paymentMethod === "qr" ? "Chuyển khoản QR" : "Tiền mặt"}
              </DetailRow>
              <DetailRow label="Đã thanh toán">
                <span className={paidAmount >= totalVnd && paidAmount > 0 ? "text-emerald-600" : paidAmount > 0 ? "text-amber-600" : "text-slate-500"}>
                  {formatVnd(paidAmount)}
                </span>
              </DetailRow>
              <DetailRow label="Trạng thái">
                <Badge tone={orderPaymentTone(paymentStatus)}>{ORDER_PAYMENT_STATUS_LABEL[paymentStatus]}</Badge>
              </DetailRow>
              {paymentStatus === "UNDERPAID" && totalVnd > paidAmount && (
                <DetailRow label="Còn thiếu">
                  <span className="text-red-600">{formatVnd(totalVnd - paidAmount)}</span>
                </DetailRow>
              )}
              {order.payment?.paymentCode && (
                <DetailRow label="Mã thanh toán">
                  <span className="font-mono text-xs">{order.payment.paymentCode}</span>
                </DetailRow>
              )}
            </dl>

            {payments.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">Lịch sử thanh toán</p>
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-ink">{p.paymentCode ?? "—"}</span>
                        <Badge tone={Number(p.receivedAmount) > 0 ? "green" : "gray"}>
                          {Number(p.receivedAmount) > 0 ? "Đã thanh toán" : "Chưa thanh toán"}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>Dự kiến {formatVnd(Number(p.expectedAmount))}</span>
                        <span className="tabular-nums">{formatDateTime(p.createdAt)}</span>
                      </div>
                      {Number(p.receivedAmount) > 0 && (
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
                          <span>Đã nhận {formatVnd(Number(p.receivedAmount))}</span>
                          {p.confirmedAt && <span className="tabular-nums">{formatDateTime(p.confirmedAt)}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* Khách hàng */}
          <Panel title="Khách hàng" className="flex-1">
            <dl className="divide-y divide-line-soft">
              <DetailRow label="Họ tên">
                {order.creator.fullName}
              </DetailRow>
              <DetailRow label="Telegram">
                <span className="font-mono text-xs">{order.creator.telegramUserId ?? "—"}</span>
              </DetailRow>
              <DetailRow label="Username">@{order.creator.username || "—"}</DetailRow>
              <DetailRow label="Vị trí">{order.customerNote || "—"}</DetailRow>
              {order.paidAt && (
                <DetailRow label="Thanh toán lúc">{formatDateTime(order.paidAt)}</DetailRow>
              )}
              {order.assignedBaristaId && (
                <DetailRow label="Barista phụ trách">
                  <span className="font-mono text-xs">{order.assignedBaristaId}</span>
                </DetailRow>
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
        title={`Xác nhận đã thu ${formatVnd(totalVnd)}`}
        subtitle={`Đơn ${order.orderCode} · ${order.customerNote || "Không ghi vị trí"}`}
      >
        <form onSubmit={confirmCashSubmit} className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Xác nhận bạn đã nhận đủ <strong>{formatVnd(totalVnd)}</strong> tiền mặt từ khách hàng. Đơn sẽ được chuyển sang trạng thái <strong>“Đã thanh toán”</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCashOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn" disabled={busy}>
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
        title={`Chuyển khoản ${formatVnd(Number(qrAmount) || totalVnd)}`}
        subtitle="Khách quét mã và chuyển khoản đúng nội dung bên dưới."
      >
        <div className="space-y-4">
          <FakeQR seed={order.orderCode} />
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
            <span className="block text-xs text-muted">Nội dung chuyển khoản</span>
            <strong className="mt-0.5 block font-mono text-lg font-extrabold tracking-widest text-ink">{qrContent || order.orderCode}</strong>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setQrOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn" disabled={busy} onClick={confirmQrPaid}>
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
        title={`Hoàn tiền cho đơn ${order.orderCode}`}
        subtitle="Chỉ khả dụng với đơn đã thanh toán (PAID / thiếu / thừa)."
      >
        <form onSubmit={submitRefund} className="space-y-4">
          <Field label="Số tiền hoàn" hint={`Số dư đã thanh toán: ${formatVnd(paidAmount)}`}>
            <input
              className="input"
              type="number"
              min={0}
              max={paidAmount || totalVnd}
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
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setRefundOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              Xác nhận hoàn tiền
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal hủy đơn */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        eyebrow="HỦY ĐƠN"
        title={`Hủy đơn ${order.orderCode}`}
        subtitle="Đơn sẽ chuyển sang trạng thái đã hủy và không thể tiếp tục."
      >
        <form onSubmit={submitCancel} className="space-y-4">
          <Field label="Lý do hủy đơn (bắt buộc)">
            <textarea
              className="input min-h-[90px] resize-y"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: khách hủy, hết nguyên liệu..."
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCancelOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              Xác nhận hủy
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal thêm món */}
      <Modal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        eyebrow="THÊM MÓN"
        title="Thêm món vào đơn"
        subtitle="Chỉ món đang bán — giá luôn lấy từ backend."
        wide
      >
        <form onSubmit={submitAddItem} className="space-y-4">
          <Field label="Món">
            <select className="input" value={addItemId} onChange={(e) => setAddItemId(e.target.value)} required>
              <option value="">Chọn món…</option>
              {menu.categories
                .filter((category) => category.isActive)
                .map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    {availableItems
                      .filter((item) => item.categoryId === category.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatVnd(item.price)}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số lượng">
              <input className="input" type="number" min={1} value={addItemQty} onChange={(e) => setAddItemQty(Number(e.target.value))} />
            </Field>
            <Field label="Ghi chú món">
              <input className="input" value={addItemNote} onChange={(e) => setAddItemNote(e.target.value)} placeholder="Ít đá, không đường…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setAddItemOpen(false)}>Hủy</button>
            <button type="submit" className="btn" disabled={busy}>Thêm món</button>
          </div>
        </form>
      </Modal>

      {/* Modal sửa món */}
      <Modal
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        eyebrow="SỬA MÓN"
        title={`Sửa món ${editItem?.name ?? ""}`}
        subtitle="Số lượng và ghi chú sẽ được cập nhật lại tổng tiền đơn."
      >
        <form onSubmit={submitEditItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số lượng">
              <input className="input" type="number" min={1} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} />
            </Field>
            <Field label="Ghi chú món">
              <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ít đá, không đường…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditItem(null)}>Hủy</button>
            <button type="submit" className="btn" disabled={busy}>Lưu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
