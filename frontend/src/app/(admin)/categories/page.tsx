"use client";

import { useState, Fragment, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { categories, type Category } from "@/lib/data";

export default function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Category[]>(categories);
  const [creating, setCreating] = useState(false);

  const stats = {
    total: rows.length,
    active: rows.filter((c) => c.active).length,
    products: rows.reduce((s, c) => s + c.productCount, 0),
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: (formData.get("name") as string) || "Danh mục mới",
      nameEn: (formData.get("nameEn") as string) || undefined,
      slug: (formData.get("slug") as string) || "danh-muc-moi",
      emoji: (formData.get("emoji") as string) || "📂",
      sortOrder: Number(formData.get("sortOrder")) || 0,
      active: true,
      productCount: 0,
    };
    setRows([newCat, ...rows]);
    toast.push(`Đã tạo danh mục "${newCat.name}".`, "success");
    setCreating(false);
  };

  const remove = (cat: Category) => {
    if (confirm(`Bạn có chắc muốn xóa danh mục "${cat.name}"?`)) {
      setRows(rows.filter((c) => c.id !== cat.id));
      toast.push(`Đã xóa danh mục "${cat.name}".`, "warning");
    }
  };

  return (
    <div>
      <PageHeader title="Danh mục thực đơn" description="Tách riêng danh mục khỏi trang sản phẩm để dễ sắp xếp, đặt tên song ngữ và bật/tắt hiển thị.">
        <button type="button" className="btn" onClick={() => setCreating(true)}>Thêm danh mục</button>
      </PageHeader>

      <Stats
        items={[
          { label: "Tổng danh mục", value: stats.total },
          { label: "Đang bật", value: stats.active, tone: "green" },
          { label: "Sản phẩm", value: stats.products, tone: "teal" },
        ]}
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        eyebrow="THÊM MỚI"
        title="Tạo danh mục"
        subtitle="Danh mục mới sẽ xuất hiện trong bot và trang sản phẩm."
      >
        <form onSubmit={create} className="space-y-3">
          <Field label="Tên tiếng Việt"><input className="input" name="name" placeholder="Ví dụ: Đồ uống đá xay" required /></Field>
          <Field label="Tên tiếng Anh"><input className="input" name="nameEn" placeholder="Ice Blended" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug"><input className="input" name="slug" placeholder="do-uong-da-xay" required /></Field>
            <Field label="Biểu tượng"><input className="input" name="emoji" placeholder="🍹" /></Field>
            <Field label="Thứ tự"><input className="input" name="sortOrder" type="number" defaultValue={0} /></Field>
            <label className="flex items-end pb-2 text-sm text-ink"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line accent-forest-800" /> Đang hiển thị</label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Đóng</button>
            <button type="submit" className="btn">Thêm danh mục</button>
          </div>
        </form>
      </Modal>

      <Panel eyebrow="DANH SÁCH" title="Quản lý danh mục" right={<span className="text-sm text-muted">{rows.length} danh mục</span>}>
        {rows.length === 0 ? (
          <EmptyState>Chưa có danh mục. Bấm “Thêm danh mục” để tạo danh mục đầu tiên.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-slate-50/70">
                  <th className="th">Danh mục</th>
                  <th className="th">Slug</th>
                  <th className="th text-center">Thứ tự</th>
                  <th className="th text-center">Sản phẩm</th>
                  <th className="th">Trạng thái</th>
                  <th className="th text-right pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((cat) => (
                  <CategoryRow key={cat.id} category={cat} onDelete={() => remove(cat)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CategoryRow({ category, onDelete }: { category: Category; onDelete: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  return (
    <Fragment>
      <tr className="border-b border-line-soft transition hover:bg-slate-50/80">
        <td className="td">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg shadow-xs">{category.emoji || "•"}</span>
            <div>
              <strong className="block text-sm font-bold text-ink leading-tight">{category.name}</strong>
              <small className="text-xs text-muted">{category.nameEn || "Chưa có tên EN"}</small>
            </div>
          </div>
        </td>
        <td className="td font-mono text-xs font-semibold text-ink">{category.slug}</td>
        <td className="td text-center font-bold tabular-nums text-ink">{category.sortOrder}</td>
        <td className="td text-center font-bold tabular-nums text-ink">{category.productCount} món</td>
        <td className="td whitespace-nowrap">
          <Badge tone={category.active ? "green" : "gray"}>{category.active ? "Đang bật" : "Đã tắt"}</Badge>
        </td>
        <td className="td pr-4">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => setEditing(!editing)}>
              {editing ? "Đóng" : "Sửa"}
            </button>
            <button type="button" className="btn-danger text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={onDelete}>
              Xóa
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-brand-50/30 p-4 border-b border-line">
            <form
              onSubmit={(e) => { e.preventDefault(); toast.push(`Đã lưu danh mục "${category.name}".`, "success"); setEditing(false); }}
              className="space-y-3 rounded-xl border border-brand-200 bg-white p-4 shadow-xs"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Tên VN"><input className="input" defaultValue={category.name} required /></Field>
                <Field label="Tên EN"><input className="input" defaultValue={category.nameEn} placeholder="English name" /></Field>
                <Field label="Slug"><input className="input" defaultValue={category.slug} required /></Field>
                <Field label="Biểu tượng"><input className="input" defaultValue={category.emoji} /></Field>
                <Field label="Thứ tự"><input className="input" type="number" defaultValue={category.sortOrder} /></Field>
                <label className="flex items-end pb-2 text-sm text-ink"><input type="checkbox" defaultChecked={category.active} className="h-4 w-4 rounded border-line accent-forest-800" /> Đang hiển thị</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Hủy</button>
                <button type="submit" className="btn">Lưu danh mục</button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
