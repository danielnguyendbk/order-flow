"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd } from "@/lib/format";
import {
  createOrder,
  getCategories,
  getMenuItems,
  type ApiCategory,
  type ApiMenuItem,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

interface OrderRow {
  menuItemId: string;
  quantity: number;
  note: string;
}

export default function NewOrderPage() {
  const toast = useToast();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QR">("CASH");
  const [customerNote, setCustomerNote] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([{ menuItemId: "", quantity: 1, note: "" }]);
  const [busy, setBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    const [categories, items] = await Promise.all([
      getCategories(),
      getMenuItems(500),
    ]);
    return { categories: categories.data, items: items.data };
  }, []);

  const { data: catalog, loading, error } = useApiData(loadCatalog, {
    categories: [] as ApiCategory[],
    items: [] as ApiMenuItem[],
  });

  const availableItems = useMemo(() => catalog.items.filter((item) => item.isAvailable), [catalog.items]);
  const itemById = useMemo(() => new Map(availableItems.map((item) => [item.id, item])), [availableItems]);
  const categoryById = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c])), [catalog.categories]);

  const totalVnd = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const price = itemById.get(row.menuItemId)?.price ?? 0;
        return sum + price * Math.max(0, row.quantity || 0);
      }, 0),
    [rows, itemById],
  );

  const updateRow = (index: number, patch: Partial<OrderRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, { menuItemId: "", quantity: 1, note: "" }]);
  };

  const removeRow = (index: number) => {
    setRows((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const items = rows
      .filter((row) => row.menuItemId)
      .map((row) => ({
        menuItemId: row.menuItemId,
        quantity: Math.max(1, Math.round(row.quantity) || 1),
        note: row.note.trim() || undefined,
      }));
    if (items.length === 0) {
      toast.push("Vui lòng chọn ít nhất một món.", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await createOrder({
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
        items,
      });
      toast.push(`Đã tạo đơn ${created.orderCode}.`, "success");
      router.push(`/orders/${created.id}`);
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể tạo đơn.", "error");
      setBusy(false);
    }
  };

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader title="Tạo đơn mới" description="Đặt món thủ công từ web cho khách gọi điện hoặc đặt trước.">
        <Link href="/orders" className="btn-ghost">← Quay lại danh sách</Link>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-4 text-sm text-muted">Đang tải thực đơn...</div>}

      <form onSubmit={submit} className="space-y-6">
        <Panel title="Khách hàng" subtitle="Đơn được ghi nhận theo tài khoản đang đăng nhập.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vị trí / ghi chú đơn" hint="Ví dụ: Bàn 5, mang đi, ít đá…">
              <input
                className="input"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ghi chú hiển thị trên đơn"
              />
            </Field>
            <Field label="Phương thức thanh toán" hint="Chọn để trang chi tiết hiển thị đúng thao tác thu tiền.">
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "QR")}
              >
                <option value="CASH">Tiền mặt</option>
                <option value="QR">Chuyển khoản QR</option>
              </select>
            </Field>
          </div>
        </Panel>

        <Panel
          title="Món trong đơn"
          subtitle="Chọn món đang bán — giá luôn lấy từ backend."
          right={<span className="text-sm text-muted">{rows.length} dòng</span>}
        >
          {availableItems.length === 0 ? (
            <EmptyState>Chưa có món nào đang bán trong thực đơn.</EmptyState>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => {
                const selected = itemById.get(row.menuItemId);
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface-soft p-4 sm:grid-cols-[1fr_90px_1fr_auto]"
                  >
                    <Field label="Món">
                      <select
                        className="input"
                        value={row.menuItemId}
                        onChange={(e) => updateRow(index, { menuItemId: e.target.value })}
                      >
                        <option value="">Chọn món…</option>
                        {catalog.categories
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
                    <Field label="SL">
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Ghi chú món">
                      <input
                        className="input"
                        value={row.note}
                        onChange={(e) => updateRow(index, { note: e.target.value })}
                        placeholder="Ít đá, không hành…"
                      />
                    </Field>
                    <div className="flex items-end gap-2">
                      <span className="pb-2 text-sm font-bold tabular-nums text-ink">
                        {formatVnd((selected?.price ?? 0) * Math.max(0, row.quantity || 0))}
                      </span>
                      <button
                        type="button"
                        className="btn-danger px-3 py-2 text-xs"
                        onClick={() => removeRow(index)}
                        disabled={rows.length === 1}
                        aria-label="Xóa dòng"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn-ghost" onClick={addRow}>+ Thêm món</button>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted">
              {categoryById.size} danh mục · {availableItems.length} món đang bán
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted">Tạm tính</span>
              <strong className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                {formatVnd(totalVnd)}
              </strong>
              <button type="submit" className="btn" disabled={busy || loading}>
                {busy ? "Đang tạo..." : "Tạo đơn"}
              </button>
            </div>
          </div>
        </Panel>
      </form>
    </div>
  );
}
