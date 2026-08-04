"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
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
    const data = new FormData(form);
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: String(data.get("name")),
      nameEn: String(data.get("nameEn") || ""),
      slug: String(data.get("slug")),
      emoji: String(data.get("emoji") || "•"),
      active: true,
      sortOrder: Number(data.get("sortOrder")) || 0,
      productCount: 0,
    };
    setRows((prev) => [newCat, ...prev]);
    toast.push(`Đã tạo danh mục "${newCat.name}".`, "success");
    setCreating(false);
    form.reset();
  };

  const remove = (cat: Category) => {
    if (cat.productCount > 0) {
      toast.push(`Không xóa được "${cat.name}" vì còn ${cat.productCount} sản phẩm.`, "error");
      return;
    }
    setRows((prev) => prev.filter((c) => c.id !== cat.id));
    toast.push(`Đã xóa danh mục "${cat.name}".`, "warning");
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
          <Field label="Tên tiếng Việt"><input className="input" name="name" placeholder="ChatGPT" required /></Field>
          <Field label="Tên tiếng Anh"><input className="input" name="nameEn" placeholder="ChatGPT" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug"><input className="input" name="slug" placeholder="chatgpt" required /></Field>
            <Field label="Biểu tượng"><input className="input" name="emoji" placeholder="AI" /></Field>
            <Field label="Thứ tự"><input className="input" name="sortOrder" type="number" defaultValue={0} /></Field>
            <label className="flex items-end pb-2 text-sm text-ink"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line accent-brand-600" /> Đang hiển thị</label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Đóng</button>
            <button type="submit" className="btn">Thêm danh mục</button>
          </div>
        </form>
      </Modal>

      <Panel eyebrow="DANH SÁCH" title="Quản lý danh mục" right={<span className="text-sm text-muted">{rows.length} danh mục</span>}>
        {rows.length === 0 && <EmptyState>Chưa có danh mục. Bấm “Thêm danh mục” để tạo danh mục đầu tiên.</EmptyState>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((cat) => (
            <CategoryCard key={cat.id} category={cat} onDelete={() => remove(cat)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CategoryCard({ category, onDelete }: { category: Category; onDelete: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  return (
    <article className={`rounded-xl border p-4 transition hover:border-brand-300 ${category.active ? "border-line bg-surface-soft" : "border-line bg-slate-50 opacity-75"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{category.emoji || "•"}</span>
          <div>
            <strong className="block text-ink">{category.name}</strong>
            <small className="text-xs text-muted">{category.nameEn || "Chưa có tên tiếng Anh"} · {category.productCount} sản phẩm</small>
          </div>
        </div>
        <Badge tone={category.active ? "green" : "gray"}>{category.active ? "Đang bật" : "Đã tắt"}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-white p-2.5 text-center">
        <div><dt className="text-[11px] text-muted">Slug</dt><dd className="truncate text-xs font-bold text-ink">{category.slug}</dd></div>
        <div><dt className="text-[11px] text-muted">Thứ tự</dt><dd className="text-xs font-bold text-ink">{category.sortOrder}</dd></div>
        <div><dt className="text-[11px] text-muted">Sản phẩm</dt><dd className="text-xs font-bold text-ink">{category.productCount}</dd></div>
      </dl>

      {editing && (
        <form
          onSubmit={(e) => { e.preventDefault(); toast.push(`Đã lưu danh mục "${category.name}".`, "success"); setEditing(false); }}
          className="mt-3 space-y-2.5 rounded-xl border border-brand-200 bg-brand-50/50 p-3"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Tên VN"><input className="input" defaultValue={category.name} required /></Field>
            <Field label="Tên EN"><input className="input" defaultValue={category.nameEn} placeholder="English name" /></Field>
            <Field label="Slug"><input className="input" defaultValue={category.slug} required /></Field>
            <Field label="Biểu tượng"><input className="input" defaultValue={category.emoji} /></Field>
            <Field label="Thứ tự"><input className="input" type="number" defaultValue={category.sortOrder} /></Field>
            <label className="flex items-end pb-2 text-sm text-ink"><input type="checkbox" defaultChecked={category.active} className="h-4 w-4 rounded border-line accent-brand-600" /> Đang hiển thị</label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Hủy</button>
            <button type="submit" className="btn">Lưu</button>
          </div>
        </form>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={() => setEditing(!editing)}>{editing ? "Đóng sửa" : "Sửa danh mục"}</button>
        <button type="button" className="btn-danger flex-1" onClick={onDelete}>Xóa</button>
      </div>
    </article>
  );
}
