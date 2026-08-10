"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel, Badge, EmptyState, PageLoading, type Tone } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd, formatTime } from "@/lib/format";
import {
  claimOrder,
  deliverOrder,
  getBaristaOrders,
  getBaristaQueue,
  getCurrentUser,
  markOrderReady,
  type ApiBaristaOrder,
  type ApiUser,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";
import { ORDER_FULFILLMENT_STATUS_LABEL } from "@/lib/data";

interface BaristaData {
  queue: ApiBaristaOrder[];
  mine: ApiBaristaOrder[];
  me: ApiUser | null;
}

const STATUS_TONE: Record<string, Tone> = {
  QUEUED: "amber",
  PREPARING: "blue",
  READY: "teal",
};

function OrderCard({
  order,
  onAction,
  actionLabel,
  busy,
}: {
  order: ApiBaristaOrder;
  onAction?: () => void;
  actionLabel?: string;
  busy: boolean;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="font-mono text-sm font-bold text-ink">{order.orderCode}</strong>
          <span className="ml-2 text-xs text-muted">{formatTime(order.createdAt)}</span>
        </div>
        <Badge tone={STATUS_TONE[order.fulfillmentStatus] ?? "gray"}>
          {ORDER_FULFILLMENT_STATUS_LABEL[order.fulfillmentStatus]}
        </Badge>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-800">
              <strong className="font-semibold text-ink">{item.itemName}</strong>
              <span className="ml-1.5 text-xs font-semibold text-slate-500">×{item.quantity}</span>
              {item.note && <span className="block text-xs text-muted">📝 {item.note}</span>}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {formatVnd(Number(item.unitPrice) * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">📍 {order.customerNote}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
        <strong className="text-base font-extrabold tabular-nums text-ink">{formatVnd(Number(order.totalAmount))}</strong>
        {onAction && actionLabel && (
          <button type="button" className="btn text-xs px-3 py-1.5" onClick={onAction} disabled={busy}>
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}

export default function BaristaPage() {
  const toast = useToast();

  const load = useCallback(async (): Promise<BaristaData> => {
    const [queue, mePayload] = await Promise.all([
      getBaristaQueue(),
      getCurrentUser().catch(() => null),
    ]);
    const me = mePayload?.data ?? null;
    const mine = me ? await getBaristaOrders(me.id).catch(() => [] as ApiBaristaOrder[]) : [];
    return { queue, mine, me };
  }, []);

  const { data, loading, error, reload } = useApiData(load, {
    queue: [] as ApiBaristaOrder[],
    mine: [] as ApiBaristaOrder[],
    me: null as ApiUser | null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      queue: data.queue.length,
      preparing: data.mine.filter((order) => order.fulfillmentStatus === "PREPARING").length,
      ready: data.mine.filter((order) => order.fulfillmentStatus === "READY").length,
    }),
    [data],
  );

  const act = async (order: ApiBaristaOrder, action: () => Promise<unknown>, message: string) => {
    setBusyId(order.id);
    try {
      await action();
      await reload();
      toast.push(message, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const claim = (order: ApiBaristaOrder) => {
    if (!data.me) {
      toast.push("Không lấy được tài khoản đang đăng nhập.", "error");
      return;
    }
    void act(order, () => claimOrder(order.id, { baristaId: data.me!.id }), `Đã nhận đơn ${order.orderCode}.`);
  };

  const markReady = (order: ApiBaristaOrder) => {
    if (!data.me) {
      toast.push("Không lấy được tài khoản đang đăng nhập.", "error");
      return;
    }
    void act(order, () => markOrderReady(order.id, { requesterId: data.me!.id }), `Đơn ${order.orderCode} đã sẵn sàng.`);
  };

  const deliver = (order: ApiBaristaOrder) => {
    if (!data.me) {
      toast.push("Không lấy được tài khoản đang đăng nhập.", "error");
      return;
    }
    void act(order, () => deliverOrder(order.id, { requesterId: data.me!.id }), `Đã giao đơn ${order.orderCode}.`);
  };

  if (loading && data.queue.length === 0 && data.mine.length === 0) {
    return <PageLoading label="Đang tải hàng đợi pha chế..." subText="Đang kiểm tra danh sách đơn cần làm của Barista..." />;
  }

  return (
    <div>
      <PageHeader title="Pha chế" description="Hàng đợi món đã thanh toán và các đơn đang làm của bạn.">
        <button className="btn-ghost" onClick={() => void reload()}>Làm mới</button>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <span className="block text-xs font-medium text-muted">Chờ nhận đơn</span>
          <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-amber-600">{stats.queue}</strong>
        </div>
        <div className="card p-4">
          <span className="block text-xs font-medium text-muted">Đang pha chế</span>
          <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-blue-600">{stats.preparing}</strong>
        </div>
        <div className="card p-4">
          <span className="block text-xs font-medium text-muted">Sẵn sàng giao</span>
          <strong className="mt-1 block text-2xl font-extrabold tabular-nums text-brand-700">{stats.ready}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel
          title="Hàng đợi"
          subtitle="Đơn đã thanh toán, chờ nhận pha chế."
          right={<Badge tone="amber">{stats.queue} đơn</Badge>}
        >
          {data.queue.length === 0 && !loading ? (
            <EmptyState>Không có đơn nào trong hàng đợi.</EmptyState>
          ) : (
            <div className="space-y-3">
              {data.queue.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAction={() => claim(order)}
                  actionLabel="Nhận đơn"
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Đang pha chế"
          subtitle="Đơn đã nhận của bạn — hoàn thành rồi chuyển giao."
          right={<Badge tone="teal">{stats.preparing + stats.ready} đơn</Badge>}
        >
          {!data.me && !loading && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Không xác định được tài khoản — các thao tác nhận/hoàn thành sẽ bị chặn.
            </div>
          )}
          {data.mine.length === 0 && !loading ? (
            <EmptyState>Chưa nhận đơn nào. Nhận từ hàng đợi bên trái.</EmptyState>
          ) : (
            <div className="space-y-3">
              {data.mine.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onAction={order.fulfillmentStatus === "PREPARING" ? () => markReady(order) : () => deliver(order)}
                  actionLabel={order.fulfillmentStatus === "PREPARING" ? "Hoàn thành (READY)" : "Giao món (DELIVERED)"}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <p className="mt-6 text-xs text-muted">
        Trạng thái thực hiện được backend quản lý theo quy trình: QUEUED → PREPARING → READY → DELIVERED.{" "}
        <Link href="/orders" className="text-brand-700 hover:underline">Xem danh sách đơn đầy đủ →</Link>
      </p>
    </div>
  );
}
