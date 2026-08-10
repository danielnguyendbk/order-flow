"use client";

import { useCallback, useState, type FormEvent } from "react";
import { PageHeader, Panel, Field, Badge, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd } from "@/lib/format";
import { apiRequest, getCategories, getMenuItems, type ApiCategory, type ApiMenuItem } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

interface CatalogData { categories: ApiCategory[]; items: ApiMenuItem[] }

export default function CatalogPage() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async (): Promise<CatalogData> => {
    const [categories, items] = await Promise.all([getCategories(), getMenuItems()]);
    return { categories: categories.data, items: items.data };
  }, []);
  const { data, loading, error, reload } = useApiData(load, { categories: [], items: [] });

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await apiRequest("admin/menu-items", {
        method: "POST",
        body: {
          categoryId: String(values.get("categoryId")),
          name: String(values.get("name")),
          price: Number(values.get("price")),
          description: String(values.get("description") || "") || null,
          displayOrder: Number(values.get("displayOrder")) || 0,
          isAvailable: true,
        },
      });
      form.reset();
      await reload();
      toast.push("Đã thêm món vào Supabase.", "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thêm món.", "error");
    }
  };

  const updateAvailability = async (item: ApiMenuItem) => {
    setBusyId(item.id);
    try {
      await apiRequest(`admin/menu-items/${item.id}`, { method: "PATCH", body: { isAvailable: !item.isAvailable } });
      await reload();
      toast.push(`Đã ${item.isAvailable ? "tắt" : "bật"} bán "${item.name}".`, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể cập nhật món.", "error");
    } finally { setBusyId(null); }
  };

  return (
    <div>
      <PageHeader title="Quản lý Thực đơn" description="Danh mục và món được đồng bộ từ database Supabase." />
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-4 text-sm text-muted">Đang tải thực đơn thật...</div>}
      <Panel title="Thêm món" className="mb-6">
        <form onSubmit={createItem} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Danh mục"><select className="input" name="categoryId" required>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          <Field label="Tên món"><input className="input" name="name" required /></Field>
          <Field label="Giá bán"><input className="input" name="price" type="number" min={0} required /></Field>
          <Field label="Thứ tự"><input className="input" name="displayOrder" type="number" defaultValue={0} /></Field>
          <div className="flex items-end"><button className="btn w-full" disabled={data.categories.length === 0}>Thêm vào thực đơn</button></div>
          <div className="md:col-span-2 xl:col-span-5"><Field label="Mô tả"><textarea className="input" name="description" rows={2} /></Field></div>
        </form>
      </Panel>
      <Panel title="Thực đơn hiện tại" right={<span className="text-sm text-muted">{data.items.length} món</span>}>
        {data.items.length === 0 && !loading && <EmptyState>Supabase chưa có món nào.</EmptyState>}
        <div className="space-y-6">
          {data.categories.map((category) => {
            const items = data.items.filter((item) => item.categoryId === category.id);
            return (
              <section key={category.id}>
                <div className="mb-2 flex items-center justify-between"><strong className="text-ink">{category.name}</strong><Badge tone={category.isActive ? "green" : "gray"}>{items.length} món</Badge></div>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[620px]"><thead><tr className="border-b border-line"><th className="th">Món</th><th className="th">Giá</th><th className="th">Thứ tự</th><th className="th">Trạng thái</th><th className="th">Thao tác</th></tr></thead>
                    <tbody className="divide-y divide-line-soft">{items.map((item) => <tr key={item.id}><td className="td"><strong className="block text-sm text-ink">{item.name}</strong><small className="text-xs text-muted">{item.description || "Không có mô tả"}</small></td><td className="td font-bold">{formatVnd(item.price)}</td><td className="td">{item.displayOrder}</td><td className="td"><Badge tone={item.isAvailable ? "green" : "gray"}>{item.isAvailable ? "Đang bán" : "Đã tắt"}</Badge></td><td className="td"><button className="btn-ghost" disabled={busyId === item.id} onClick={() => void updateAvailability(item)}>{item.isAvailable ? "Tắt bán" : "Bật bán"}</button></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
