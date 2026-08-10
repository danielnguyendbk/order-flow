"use client";

import { useCallback, useMemo, useState, Fragment, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats, PageLoading } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  getCategories,
  getMenuItems,
  createCategory,
  updateCategory,
  deleteCategory,
  type ApiCategory,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

interface CategoryRow extends ApiCategory {
  itemCount: number;
}

export default function CategoriesPage() {
  const toast = useToast();

  const load = useCallback(async (): Promise<{ categories: CategoryRow[] }> => {
    const [categoriesPayload, itemsPayload] = await Promise.all([getCategories(), getMenuItems(500)]);
    const countByCategory = new Map<string, number>();
    for (const item of itemsPayload.data) {
      countByCategory.set(item.categoryId, (countByCategory.get(item.categoryId) ?? 0) + 1);
    }
    return {
      categories: categoriesPayload.data.map((c) => ({ ...c, itemCount: countByCategory.get(c.id) ?? 0 })),
    };
  }, []);

  const { data, loading, error, reload } = useApiData(load, { categories: [] as CategoryRow[] });
  const rows = data.categories;

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const [formName, setFormName] = useState("");
  const [formOrder, setFormOrder] = useState("0");
  const [formActive, setFormActive] = useState(true);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((c) => c.isActive).length,
      products: rows.reduce((s, c) => s + c.itemCount, 0),
    }),
    [rows]
  );

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

  const openCreate = () => {
    setFormName("");
    setFormOrder("0");
    setFormActive(true);
    setCreating(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setEditing(cat);
    setFormName(cat.name);
    setFormOrder(String(cat.displayOrder ?? 0));
    setFormActive(cat.isActive);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.push("Vui lòng nhập tên danh mục.", "error");
      return;
    }
    const body = { name: formName.trim(), displayOrder: Number(formOrder) || 0, isActive: formActive };
    if (editing) {
      void act(() => updateCategory(editing.id, body), `Đã lưu danh mục "${formName.trim()}".`);
    } else {
      void act(() => createCategory(body), `Đã tạo danh mục "${formName.trim()}".`);
    }
    setCreating(false);
    setEditing(null);
  };

  const remove = (cat: CategoryRow) => {
    if (cat.itemCount > 0) {
      toast.push(`Không thể xóa vì còn ${cat.itemCount} món trong danh mục.`, "error");
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${cat.name}"?`)) return;
    void act(() => deleteCategory(cat.id), `Đã xóa danh mục "${cat.name}".`);
  };

  if (loading && rows.length === 0) {
    return <PageLoading label="Đang tải danh mục thực đơn..." subText="Đang lấy danh sách danh mục phân loại..." />;
  }

  return (
    <div>
      <PageHeader title="Danh mục thực đơn" description="Tách riêng danh mục khỏi trang sản phẩm để dễ sắp xếp và bật/tắt hiển thị.">
        <button type="button" className="btn" onClick={openCreate}>Thêm danh mục</button>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Stats
            items={[
              { label: "Tổng danh mục", value: stats.total },
              { label: "Đang bật", value: stats.active, tone: "green" },
              { label: "Món trong thực đơn", value: stats.products, tone: "teal" },
            ]}
          />

      <Modal
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        eyebrow="THÊM / SỬA"
        title={editing ? `Sửa danh mục "${editing.name}"` : "Tạo danh mục"}
        subtitle="Danh mục mới sẽ xuất hiện trong bot và trang thực đơn."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Tên danh mục">
            <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ví dụ: Cà phê" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Thứ tự">
              <input className="input" type="number" value={formOrder} onChange={(e) => setFormOrder(e.target.value)} />
            </Field>
            <label className="flex items-end pb-2 text-sm text-ink">
              <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="h-4 w-4 rounded border-line accent-forest-800" /> Đang hiển thị
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>Đóng</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      </Modal>

      <Panel
        eyebrow="DANH SÁCH"
        title="Quản lý danh mục"
        right={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{rows.length} danh mục</span>
            <button type="button" className="btn-ghost text-xs" onClick={() => void reload()} disabled={loading}>Làm mới</button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState>Chưa có danh mục. Bấm “Thêm danh mục” để tạo danh mục đầu tiên.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-slate-50/70">
                  <th className="th">Danh mục</th>
                  <th className="th text-center">Thứ tự</th>
                  <th className="th text-center">Món</th>
                  <th className="th">Trạng thái</th>
                  <th className="th text-right pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((cat) => (
                  <Fragment key={cat.id}>
                    <tr className="border-b border-line-soft transition hover:bg-slate-50/80">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg shadow-xs">🍽️</span>
                          <div>
                            <strong className="block text-sm font-bold text-ink leading-tight">{cat.name}</strong>
                            <small className="text-xs text-muted">#{cat.displayOrder}</small>
                          </div>
                        </div>
                      </td>
                      <td className="td text-center font-bold tabular-nums text-ink">{cat.displayOrder}</td>
                      <td className="td text-center font-bold tabular-nums text-ink">{cat.itemCount} món</td>
                      <td className="td whitespace-nowrap">
                        <Badge tone={cat.isActive ? "green" : "gray"}>{cat.isActive ? "Đang bật" : "Đã tắt"}</Badge>
                      </td>
                      <td className="td pr-4">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => openEdit(cat)}>
                            Sửa
                          </button>
                          <button type="button" className="btn-danger text-xs px-3 py-1 rounded-full whitespace-nowrap" disabled={busy} onClick={() => remove(cat)}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
