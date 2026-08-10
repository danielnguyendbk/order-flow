"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  getOrder,
  getOrders,
  getCurrentUser,
  confirmCash,
  initQrPayment,
  refundOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  cancelOrder,
  getCategories,
  getMenuItems,
  apiRequest,
  type ApiCategory,
  type ApiMenuItem,
  type ApiOrder,
  type ApiUser,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import {
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_FULFILLMENT_STATUS_LABEL,
  TIMELINE_STATUS_LABEL,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/* Chuyển timeline backend (history) sang dạng hiển thị */
function toTimelineEvents(order: ApiOrder): OrderTimelineEvent[] {
  const creatorName = order.creator?.fullName?.trim() || order.creator?.username || "Hệ thống";
  const events: OrderTimelineEvent[] = [
    {
      id: `${order.id}-created`,
      status: "ORDER_CREATED",
      label: "Khách tạo đơn",
      at: order.createdAt,
      by: creatorName,
      note: order.customerNote ?? undefined,
    },
  ];

  for (const entry of order.timeline ?? []) {
    events.push({
      id: entry.id,
      status: (entry.newStatus as OrderTimelineEvent["status"]) ?? entry.newStatus,
      label: TIMELINE_STATUS_LABEL[entry.newStatus as OrderTimelineEvent["status"]] ?? entry.newStatus,
      at: entry.createdAt,
      by: entry.changedByUserId ? "Admin" : "Hệ thống",
      note: entry.reason ?? undefined,
    });
  }

  return events;
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId ?? "";
  return <OrderDetailView key={orderId} orderId={orderId} />;
}

function OrderDetailView({ orderId }: { orderId: string }) {
  const toast = useToast();

  const loadOrder = useCallback(async () => {
    try {
      return await getOrder(orderId);
    } catch {
      const list = await getOrders(500);
      const found = list.data.find((o) => o.orderCode === orderId);
      if (!found) throw new Error(`Order ${orderId} not found`);
      return found;
    }
  }, [orderId]);

  const { data: order, loading, error, reload } = useApiData(loadOrder, null as ApiOrder | null);

  const [me, setMe] = useState<ApiUser | null>(null);
  const [meError, setMeError] = useState(false);
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((payload) => { if (active) setMe(payload.data); })
      .catch(() => { if (active) setMeError(true); });
    return () => { active = false; };
  }, []);

  // Modals
  const [cashOpen, setCashOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrTransfer, setQrTransfer] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<OrderFulfillmentStatus | "">("");
  const [busy, setBusy] = useState(false);

  // Sửa món trong đơn (chỉ khi đơn còn UNPAID + PENDING_PAYMENT)
  const [menuCatalog, setMenuCatalog] = useState<{ categories: ApiCategory[]; items: ApiMenuItem[] } | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemMenuId, setAddItemMenuId] = useState("");
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemNote, setAddItemNote] = useState("");
  const [editItem, setEditItem] = useState<{ id: string; productName: string; quantity: number; note: string | null } | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [itemBusy, setItemBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const ensureMenuCatalog = useCallback(async () => {
    if (menuCatalog) return;
    try {
      const [categories, items] = await Promise.all([getCategories(), getMenuItems(500)]);
      setMenuCatalog({ categories: categories.data, items: items.data });
    } catch (catalogError) {
      setMenuError(catalogError instanceof Error ? catalogError.message : "Không tải được thực đơn.");
    }
  }, [menuCatalog]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Đang tải đơn...">
          <Link href="/orders" className="btn-ghost">
            ← Quay lại danh sách đơn
          </Link>
        </PageHeader>
        <Panel>
          <EmptyState>Đang tải thông tin đơn hàng...</EmptyState>
        </Panel>
      </div>
    );
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
            {error ?? `Không có đơn hàng nào khớp mã <strong className="text-ink">${orderId}</strong>. Vui lòng kiểm tra lại mã đơn.`}
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const detail = {
    id: order.id,
    code: order.orderCode,
    createdAt: order.createdAt,
    deliveredAt: order.fulfillmentStatus === "DELIVERED" ? order.updatedAt : undefined,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.itemName,
      unitPriceVnd: Number(item.unitPrice),
      quantity: item.quantity,
      note: item.note,
      lineTotalVnd: Number(item.unitPrice) * item.quantity,
    })),
    subtotalVnd: Number(order.totalAmount),
    discountVnd: 0,
    totalVnd: Number(order.totalAmount),
    paymentStatus: (order.paymentStatus === "REVIEW" ? "PAYMENT_REVIEW" : order.paymentStatus) as OrderPaymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.paymentMethod === "CASH" ? "cash" : "qr",
    paidAmount: Number(order.payment?.receivedAmount ?? 0),
    user: {
      telegramId: order.creator?.telegramUserId ?? "",
      firstName: order.creator?.fullName?.split(/\s+/)[0] ?? "",
      lastName: order.creator?.fullName?.split(/\s+/).slice(1).join(" ") ?? "",
      username: order.creator?.username ?? "",
    },
    customerInput: order.customerNote ?? undefined,
    timeline: toTimelineEvents(order),
  };

  const canRefund = ["PAID", "OVERPAID", "UNDERPAID"].includes(detail.paymentStatus);
  const isUnpaid = detail.paymentStatus === "UNPAID";
  // Đơn chỉ sửa được món khi chưa thanh toán và chưa vào quy trình thực hiện.
  const editable = detail.paymentStatus === "UNPAID" && detail.fulfillmentStatus === "PENDING_PAYMENT";
  const cancelable = ["PENDING_PAYMENT", "QUEUED", "PREPARING"].includes(detail.fulfillmentStatus);
  const meId = me?.id ?? "";

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      toast.push(successMessage, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác.", "error");
    } finally {
      setBusy(false);
    }
  };

  /* ── Xác nhận tiền mặt ── */
  const confirmCashAction = (e: FormEvent) => {
    e.preventDefault();
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    void run(
      () => confirmCash(detail.id, { confirmedByUserId: meId }),
      `Đã xác nhận thu tiền mặt ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`
    );
    setCashOpen(false);
  };

  /* ── Khởi tạo QR ── */
  const initQr = () => {
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    setBusy(true);
    initQrPayment(detail.id, { requestedByUserId: meId })
      .then((result) => {
        setQrTransfer(result.transferContent);
        setQrOpen(true);
      })
      .catch((actionError) =>
        toast.push(actionError instanceof Error ? actionError.message : "Không tạo được mã QR.", "error")
      )
      .finally(() => setBusy(false));
  };

  /* ── Đã nhận tiền QR (chuyển sang PAID thủ công) ── */
  const confirmQrPaid = () => {
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    void run(
      () => apiRequest(`admin/orders/${detail.id}/override-status`, {
        method: "POST",
        body: { domain: "PAYMENT", status: "PAID", reason: "Admin xác nhận đã nhận tiền QR từ web" },
      }),
      `Đã ghi nhận thanh toán QR ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`
    );
    setQrOpen(false);
  };

  /* ── Xác nhận đã thu đủ cho đơn thiếu tiền ── */
  const confirmUnderpaidAsPaid = () => {
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    void run(
      () => apiRequest(`admin/orders/${detail.id}/override-status`, {
        method: "POST",
        body: { domain: "PAYMENT", status: "PAID", reason: "Admin xác nhận đã thu đủ tiền từ web" },
      }),
      `Đã xác nhận thu đủ ${formatVnd(detail.totalVnd)} cho đơn ${detail.code}.`
    );
  };

  /* ── Thêm món vào đơn ── */
  const openAddItem = () => {
    setAddItemMenuId("");
    setAddItemQty(1);
    setAddItemNote("");
    void ensureMenuCatalog();
    setAddItemOpen(true);
  };

  const submitAddItem = (e: FormEvent) => {
    e.preventDefault();
    if (!addItemMenuId) {
      toast.push("Vui lòng chọn món.", "error");
      return;
    }
    setItemBusy(true);
    addOrderItem(detail.id, {
      menuItemId: addItemMenuId,
      quantity: Math.max(1, Math.round(addItemQty) || 1),
      note: addItemNote.trim() || undefined,
    })
      .then(async () => {
        await reload();
        toast.push("Đã thêm món vào đơn.", "success");
        setAddItemOpen(false);
      })
      .catch((actionError) =>
        toast.push(actionError instanceof Error ? actionError.message : "Không thể thêm món.", "error"),
      )
      .finally(() => setItemBusy(false));
  };

  /* ── Sửa món trong đơn ── */
  const openEditItem = (item: (typeof detail.items)[number]) => {
    setEditItem({ id: item.id, productName: item.productName, quantity: item.quantity, note: item.note });
    setEditQty(item.quantity);
    setEditNote(item.note ?? "");
  };

  const submitEditItem = (e: FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const body: { quantity?: number; note?: string | null } = {
      quantity: Math.max(1, Math.round(editQty) || 1),
      note: editNote.trim() || null,
    };
    setItemBusy(true);
    updateOrderItem(detail.id, editItem.id, body)
      .then(async () => {
        await reload();
        toast.push("Đã cập nhật món.", "success");
        setEditItem(null);
      })
      .catch((actionError) =>
        toast.push(actionError instanceof Error ? actionError.message : "Không thể cập nhật món.", "error"),
      )
      .finally(() => setItemBusy(false));
  };

  /* ── Xóa món khỏi đơn ── */
  const removeItem = (item: (typeof detail.items)[number]) => {
    if (!window.confirm(`Xóa "${item.productName}" khỏi đơn?`)) return;
    setItemBusy(true);
    deleteOrderItem(detail.id, item.id)
      .then(async () => {
        await reload();
        toast.push(`Đã xóa "${item.productName}".`, "warning");
      })
      .catch((actionError) =>
        toast.push(actionError instanceof Error ? actionError.message : "Không thể xóa món.", "error"),
      )
      .finally(() => setItemBusy(false));
  };

  /* ── Hủy đơn (endpoint chuyên dụng) ── */
  const submitCancel = (e: FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.push("Vui lòng nhập lý do hủy đơn.", "error");
      return;
    }
    setItemBusy(true);
    cancelOrder(detail.id, { reason: cancelReason.trim(), requesterId: meId || undefined })
      .then(async () => {
        await reload();
        toast.push(`Đã hủy đơn ${detail.code}.`, "warning");
        setCancelOpen(false);
        setCancelReason("");
      })
      .catch((actionError) =>
        toast.push(actionError instanceof Error ? actionError.message : "Không thể hủy đơn.", "error"),
      )
      .finally(() => setItemBusy(false));
  };

  /* ── Hoàn tiền (Refund) ── */
  const submitRefund = (e: FormEvent) => {
    e.preventDefault();
    const amount = Math.min(Math.max(0, refundAmount || 0), detail.paidAmount || detail.totalVnd);
    if (amount <= 0) {
      toast.push("Số tiền hoàn phải lớn hơn 0.", "error");
      return;
    }
    if (!refundReason.trim()) {
      toast.push("Vui lòng nhập lý do hoàn tiền.", "error");
      return;
    }
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    void run(
      () => refundOrder(detail.id, { refundedByUserId: meId, reason: refundReason.trim(), amount }),
      `Đã hoàn tiền ${formatVnd(amount)} cho đơn ${detail.code}.`
    );
    setRefundOpen(false);
    setRefundAmount(0);
    setRefundReason("");
  };

  /* ── Đổi trạng thái thực hiện ── */
  const applyStatus = () => {
    if (!overrideStatus || overrideStatus === detail.fulfillmentStatus || !meId) return;
    if (!meId) {
      toast.push(meError ? "Không lấy được tài khoản đang đăng nhập." : "Đang tải tài khoản...", "error");
      return;
    }
    const label = ORDER_FULFILLMENT_STATUS_LABEL[overrideStatus];
    void run(
      () => apiRequest(`admin/orders/${detail.id}/override-status`, {
        method: "POST",
        body: { domain: "FULFILLMENT", status: overrideStatus, reason: "Cập nhật thủ công từ Web Admin" },
      }),
      `Đã đổi trạng thái đơn ${detail.code} sang “${label}”.`
    );
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

      {meError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Không lấy được tài khoản đang đăng nhập — một số thao tác sẽ bị chặn.
        </div>
      )}

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
              editable ? (
                <button type="button" className="btn text-xs px-3 py-1.5" onClick={openAddItem}>
                  + Thêm món
                </button>
              ) : undefined
            }
          >
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Món</th>
                    <th className="th text-right">Đơn giá</th>
                    <th className="th text-center">SL</th>
                    <th className="th text-right">Thành tiền</th>
                    {editable && <th className="th text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {detail.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-soft transition-colors">
                      <td className="td">
                        <strong className="block text-sm text-ink">{item.productName}</strong>
                        {item.note && <small className="block text-xs text-muted">Ghi chú: {item.note}</small>}
                      </td>
                      <td className="td text-right tabular-nums text-slate-700">{formatVnd(item.unitPriceVnd)}</td>
                      <td className="td text-center font-bold tabular-nums text-ink">×{item.quantity}</td>
                      <td className="td text-right font-bold tabular-nums text-ink">{formatVnd(item.lineTotalVnd)}</td>
                      {editable && (
                        <td className="td">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" className="btn-ghost text-xs px-2.5 py-1" onClick={() => openEditItem(item)} disabled={itemBusy}>
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn-danger text-xs px-2.5 py-1"
                              onClick={() => removeItem(item)}
                              disabled={itemBusy || detail.items.length === 1}
                              title={detail.items.length === 1 ? "Không thể xóa món cuối cùng" : undefined}
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
                    <td colSpan={editable ? 4 : 3} className="td text-right text-xs text-muted">
                      Tạm tính
                    </td>
                    <td className="td text-right tabular-nums text-slate-700">{formatVnd(detail.subtotalVnd)}</td>
                  </tr>
                  <tr>
                    <td colSpan={editable ? 4 : 3} className="td text-right text-sm font-bold text-ink">
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
                <button type="button" className="btn w-full" onClick={initQr}>
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
              {cancelable && (
                <button type="button" className="btn-danger w-full" onClick={() => { setCancelReason(""); setCancelOpen(true); }} disabled={busy}>
                  ✕ Hủy đơn
                </button>
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
                    disabled={!overrideStatus || overrideStatus === detail.fulfillmentStatus || busy}
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
        <form onSubmit={confirmCashAction} className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Xác nhận bạn đã nhận đủ <strong>{formatVnd(detail.totalVnd)}</strong> tiền mặt từ khách hàng. Đơn sẽ được chuyển sang trạng thái <strong>“Đã thanh toán”</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCashOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Đang xử lý..." : "Xác nhận đã thu tiền"}
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
        subtitle="Khách chuyển khoản đúng nội dung bên dưới."
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
            <span className="block text-xs text-muted">Nội dung chuyển khoản</span>
            <strong className="mt-0.5 block font-mono text-lg font-extrabold tracking-widest text-ink">
              {qrTransfer || detail.code}
            </strong>
          </div>
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            Mã QR đã được tạo phía backend. Sau khi nhận được webhook SePay, đơn sẽ tự động chuyển sang trạng thái đã thanh toán.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setQrOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn" onClick={confirmQrPaid} disabled={busy}>
              {busy ? "Đang xử lý..." : "Đã nhận tiền (PAID)"}
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
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setRefundOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? "Đang xử lý..." : "Xác nhận hoàn tiền"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal thêm món */}
      <Modal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        eyebrow="THÊM MÓN"
        title={`Thêm món vào đơn ${detail.code}`}
        subtitle="Giá lấy từ thực đơn hiện tại, lưu snapshot khi thêm."
      >
        <form onSubmit={submitAddItem} className="space-y-4">
          {menuError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{menuError}</div>}
          {!menuCatalog && !menuError && <p className="text-sm text-muted">Đang tải thực đơn...</p>}
          <Field label="Món">
            <select
              className="input"
              value={addItemMenuId}
              onChange={(e) => setAddItemMenuId(e.target.value)}
              disabled={!menuCatalog}
              required
            >
              <option value="">Chọn món…</option>
              {menuCatalog?.categories
                .filter((category) => category.isActive)
                .map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    {menuCatalog.items
                      .filter((item) => item.categoryId === category.id && item.isAvailable)
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
              <input
                className="input"
                type="number"
                min={1}
                value={addItemQty}
                onChange={(e) => setAddItemQty(Number(e.target.value))}
              />
            </Field>
            <Field label="Ghi chú món">
              <input
                className="input"
                value={addItemNote}
                onChange={(e) => setAddItemNote(e.target.value)}
                placeholder="Ít đá, không hành…"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setAddItemOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn" disabled={itemBusy || !menuCatalog}>
              {itemBusy ? "Đang thêm..." : "Thêm món"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal sửa món */}
      <Modal
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        eyebrow="SỬA MÓN"
        title={`Sửa "${editItem?.productName ?? ""}"`}
        subtitle="Đơn sẽ tính lại tổng tiền sau khi lưu."
      >
        <form onSubmit={submitEditItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số lượng">
              <input
                className="input"
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
              />
            </Field>
            <Field label="Ghi chú món">
              <input
                className="input"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Không ghi chú"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditItem(null)}>
              Hủy
            </button>
            <button type="submit" className="btn" disabled={itemBusy}>
              {itemBusy ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal hủy đơn */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        eyebrow="HỦY ĐƠN"
        title={`Hủy đơn ${detail.code}`}
        subtitle="Hành động này không thể hoàn tác — lý do bắt buộc."
      >
        <form onSubmit={submitCancel} className="space-y-4">
          <Field label="Lý do hủy (bắt buộc)">
            <textarea
              className="input min-h-[90px] resize-y"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: khách hủy, đặt sai món..."
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCancelOpen(false)}>
              Giữ đơn
            </button>
            <button type="submit" className="btn-danger" disabled={itemBusy}>
              {itemBusy ? "Đang hủy..." : "Xác nhận hủy đơn"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
