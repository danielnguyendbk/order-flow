"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { apiRequest, getCategories, getMenuItems, type ApiCategory } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

type CategoryRow = ApiCategory & { productCount: number };

export default function CategoriesPage() {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const [categories, items] = await Promise.all([getCategories(), getMenuItems()]);
    return categories.data.map((category) => ({
      ...category,
      productCount: items.data.filter((item) => item.categoryId === category.id).length,
    }));
  }, []);
  const { data: rows, loading, error, reload } = useApiData(load, [] as CategoryRow[]);
  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.isActive).length,
    products: rows.reduce((sum, row) => sum + row.productCount, 0),
  }), [rows]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest("admin/menu-categories", {
        method: "POST",
        body: {
          name: String(data.get("name")),
          displayOrder: Number(data.get("displayOrder")) || 0,
          isActive: true,
        },
      });
      form.reset();
      setCreating(false);
      await reload();
      toast.push("Đã tạo danh mục trên hệ thống.", "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể tạo danh mục.", "error");
    }
  };

  const update = async (category: CategoryRow, body: Partial<ApiCategory>) => {
    try {
      await apiRequest(`admin/menu-categories/${category.id}`, { method: "PATCH", body });
      await reload();
      toast.push(`Đã cập nhật "${category.name}".`, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể cập nhật danh mục.", "error");
    }
  };

  const remove = async (category: CategoryRow) => {
    if (category.productCount > 0) {
      toast.push(`Không thể xóa vì còn ${category.productCount} món.`, "error");
      return;
    }
    try {
      await apiRequest(`admin/menu-categories/${category.id}`, { method: "DELETE" });
      await reload();
      toast.push(`Đã xóa "${category.name}".`, "warning");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể xóa danh mục.", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Danh mục thực đơn" description="Dữ liệu danh mục đang được đọc trực tiếp từ backend qua API.">
        <button type="button" className="btn" onClick={() => setCreating(true)}>Thêm danh mục</button>
      </PageHeader>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-4 text-sm text-muted">Đang tải danh mục...</div>}
      <Stats items={[
        { label: "Tổng danh mục", value: stats.total },
        { label: "Đang bật", value: stats.active, tone: "green" },
        { label: "Món trong thực đơn", value: stats.products, tone: "teal" },
      ]} />
      <Modal open={creating} onClose={() => setCreating(false)} eyebrow="THÊM MỚI" title="Tạo danh mục" subtitle="Dữ liệu sẽ được ghi vào hệ thống.">
        <form onSubmit={create} className="space-y-3">
          <Field label="Tên danh mục"><input className="input" name="name" required /></Field>
          <Field label="Thứ tự"><input className="input" name="displayOrder" type="number" defaultValue={0} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Đóng</button><button className="btn">Thêm danh mục</button></div>
        </form>
      </Modal>
      <Panel title="Danh sách danh mục" right={<span className="text-sm text-muted">{rows.length} danh mục</span>}>
        {rows.length === 0 && !loading && <EmptyState>Chưa có danh mục.</EmptyState>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((category) => (
            <article key={category.id} className="rounded-lg border border-line bg-surface-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div><strong className="block text-ink">{category.name}</strong><small className="text-xs text-muted">{category.productCount} món · thứ tự {category.displayOrder}</small></div>
                <Badge tone={category.isActive ? "green" : "gray"}>{category.isActive ? "Đang bật" : "Đã tắt"}</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => void update(category, { isActive: !category.isActive })}>{category.isActive ? "Tắt" : "Bật"}</button>
                <button className="btn-danger flex-1" onClick={() => void remove(category)}>Xóa</button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
