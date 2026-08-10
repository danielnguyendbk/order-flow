"use client";

import { useCallback, useState, Fragment, type FormEvent } from "react";
import { PageHeader, Panel, Field, Badge, EmptyState, Modal, PageLoading } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd } from "@/lib/format";
import {
  getCategories,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  type ApiCategory,
  type ApiMenuItem,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

interface CatalogData {
  categories: ApiCategory[];
  items: ApiMenuItem[];
}

export default function CatalogPage() {
  const toast = useToast();

  const load = useCallback(async (): Promise<CatalogData> => {
    const [categoriesPayload, itemsPayload] = await Promise.all([getCategories(), getMenuItems(500)]);
    return { categories: categoriesPayload.data, items: itemsPayload.data };
  }, []);

  const { data, loading, error, reload } = useApiData<CatalogData>(load, {
    categories: [] as ApiCategory[],
    items: [] as ApiMenuItem[],
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ApiMenuItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Form thêm món
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formOrder, setFormOrder] = useState("0");
  const [formDescription, setFormDescription] = useState("");
  const [formAvailable, setFormAvailable] = useState(true);

  const openAdd = () => {
    setFormCategoryId(data.categories.find((c) => c.isActive)?.id ?? "");
    setFormName("");
    setFormPrice("");
    setFormOrder("0");
    setFormDescription("");
    setFormAvailable(true);
    setAddOpen(true);
  };

  const openEdit = (item: ApiMenuItem) => {
    setEditing(item);
    setFormCategoryId(item.categoryId);
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormOrder(String(item.displayOrder ?? 0));
    setFormDescription(item.description ?? "");
    setFormAvailable(item.isAvailable);
  };

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const price = Number(String(formPrice).replace(/[^0-9]/g, ""));
    if (!formName.trim()) {
      toast.push("Vui lòng nhập tên món.", "error");
      return;
    }
    if (!formCategoryId) {
      toast.push("Vui lòng chọn danh mục.", "error");
      return;
    }
    if (price <= 0) {
      toast.push("Giá bán phải lớn hơn 0.", "error");
      return;
    }
    const body = {
      categoryId: formCategoryId,
      name: formName.trim(),
      description: formDescription.trim() || null,
      price,
      isAvailable: formAvailable,
      displayOrder: Number(formOrder) || 0,
    };
    if (editing) {
      void act(() => updateMenuItem(editing.id, body), `Đã lưu món "${formName.trim()}".`);
    } else {
      void act(() => createMenuItem(body), `Đã thêm món "${formName.trim()}".`);
    }
    setAddOpen(false);
    setEditing(null);
  };

  const toggleAvailable = (item: ApiMenuItem) => {
    void act(
      () => updateMenuItem(item.id, { isAvailable: !item.isAvailable }),
      `Đã ${item.isAvailable ? "tắt" : "bật"} bán "${item.name}".`,
    );
  };

  const remove = (item: ApiMenuItem) => {
    if (!confirm(`Bạn có chắc muốn xóa món "${item.name}" khỏi thực đơn?`)) return;
    void act(() => deleteMenuItem(item.id), `Đã xóa món "${item.name}".`);
  };

  if (loading && data.items.length === 0) {
    return <PageLoading label="Đang tải danh mục thực đơn..." subText="Đang đồng bộ thông tin món ăn và bảng giá..." />;
  }

  return (
    <div>
      <PageHeader title="Quản lý Thực đơn" description="Quản lý các danh mục và món ăn / đồ uống phục vụ khách hàng trên Telegram Bot.">
        <button type="button" className="btn" onClick={openAdd}>+ Thêm món</button>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Panel
            title="Danh mục hiện có"
            right={
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">{data.categories.length} danh mục · {data.items.length} món</span>
                <button type="button" className="btn-ghost text-xs" onClick={() => void reload()} disabled={loading}>Làm mới</button>
              </div>
            }
          >
        {data.categories.length === 0 ? (
          <EmptyState>Chưa có danh mục nào. Tạo danh mục tại trang “Danh mục” trước.</EmptyState>
        ) : (
          <div className="space-y-5">
            {data.categories.map((cat) => {
              const catItems = data.items.filter((item) => item.categoryId === cat.id);
              return (
                <div key={cat.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
                  {/* Category Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-xs ring-1 ring-black/5">
                        🍽️
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-base font-bold text-ink">{cat.name}</strong>
                        </div>
                        <span className="text-xs text-muted">{catItems.length} món trong danh mục</span>
                      </div>
                    </div>
                    <Badge tone={cat.isActive ? "green" : "gray"}>{cat.isActive ? "Đang bán" : "Đã tắt"}</Badge>
                  </div>

                  {/* Products Table */}
                  {catItems.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-muted">
                      Chưa có món nào trong danh mục này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] table-fixed">
                        <colgroup>
                          <col className="w-[30%]" />
                          <col className="w-[15%]" />
                          <col className="w-[15%]" />
                          <col className="w-[12%]" />
                          <col className="w-[18%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-line-soft bg-slate-50/40 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="px-5 py-2.5">Món</th>
                            <th className="px-4 py-2.5">Giá bán</th>
                            <th className="px-4 py-2.5 text-center">Thứ tự</th>
                            <th className="px-4 py-2.5">Trạng thái</th>
                            <th className="px-5 py-2.5 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line-soft">
                          {catItems.map((item) => (
                            <Fragment key={item.id}>
                              <tr className="border-b border-line-soft transition hover:bg-slate-50/60">
                                <td className="px-5 py-3">
                                  <strong className="text-sm font-bold text-ink">{item.name}</strong>
                                  {item.description && <small className="block text-xs text-muted">{item.description}</small>}
                                </td>
                                <td className="px-4 py-3"><strong className="font-bold tabular-nums text-ink">{formatVnd(item.price)}</strong></td>
                                <td className="px-4 py-3 text-center tabular-nums text-slate-600">{item.displayOrder}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Badge tone={item.isAvailable ? "green" : "gray"}>{item.isAvailable ? "Đang bán" : "Đã tắt"}</Badge>
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => openEdit(item)}>
                                      Sửa
                                    </button>
                                    <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" disabled={busy} onClick={() => toggleAvailable(item)}>
                                      {item.isAvailable ? "Tắt bán" : "Bật bán"}
                                    </button>
                                    <button type="button" className="btn-danger text-xs px-3 py-1 rounded-full whitespace-nowrap" disabled={busy} onClick={() => remove(item)}>
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
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Modal thêm / sửa món */}
      <Modal
        open={addOpen || editing !== null}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        eyebrow="THỰC ĐƠN"
        title={editing ? `Sửa món "${editing.name}"` : "Thêm món mới"}
        subtitle="Giá bán và tên món sẽ được hiển thị trên Telegram Bot."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Danh mục">
            <select className="input" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} required>
              <option value="">Chọn danh mục…</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tên món">
            <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ví dụ: Cà phê Sữa đá" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá bán (VND)">
              <input className="input" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} inputMode="numeric" placeholder="35000" required />
            </Field>
            <Field label="Thứ tự">
              <input className="input" type="number" value={formOrder} onChange={(e) => setFormOrder(e.target.value)} />
            </Field>
          </div>
          <Field label="Mô tả món">
            <textarea className="input" rows={2} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Thành phần, đặc điểm món..." />
          </Field>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={formAvailable} onChange={(e) => setFormAvailable(e.target.checked)} className="h-4 w-4 rounded border-line accent-forest-800 cursor-pointer" />
            Đang bán (hiển thị cho khách)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => { setAddOpen(false); setEditing(null); }}>Hủy</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm vào Thực đơn"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
