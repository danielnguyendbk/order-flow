"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Panel, Field, Badge, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatVnd } from "@/lib/format";
import { categories, products, type Product } from "@/lib/data";

export default function CatalogPage() {
  const toast = useToast();

  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    toast.push("Đã thêm danh mục mới.", "success");
    (e.target as HTMLFormElement).reset();
  };

  const addProduct = (e: FormEvent) => {
    e.preventDefault();
    toast.push("Đã thêm sản phẩm mới.", "success");
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div>
      <PageHeader title="Quản lý Thực đơn" description="Quản lý các danh mục và món ăn / đồ uống phục vụ khách hàng trên Telegram Bot.">
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Thêm danh mục mới">
          <form onSubmit={addCategory} className="space-y-3">
            <Field label="Tên danh mục"><input className="input" name="name" placeholder="Ví dụ: Cà phê, Trà sữa..." required /></Field>
            <Field label="Slug"><input className="input" name="slug" placeholder="ca-phe" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon/emoji"><input className="input" name="emoji" placeholder="☕" /></Field>
              <Field label="Thứ tự hiển thị"><input className="input" type="number" defaultValue={0} name="sortOrder" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line accent-brand-600" /> Bật hiển thị</label>
            <button type="submit" className="btn w-full">Thêm danh mục</button>
          </form>
        </Panel>

        <Panel title="Thêm món ăn / đồ uống">
          <form onSubmit={addProduct} className="space-y-3">
            <Field label="Danh mục">
              <select className="input" name="categoryId" required defaultValue={categories[0]?.id}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Tên món"><input className="input" name="name" placeholder="Ví dụ: Cà phê Sữa đá" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giá bán (VND)"><input className="input" name="priceVnd" inputMode="numeric" placeholder="35000" required /></Field>
              <Field label="Giá vốn (VND)"><input className="input" name="defaultCostVnd" inputMode="numeric" placeholder="12000" defaultValue={0} /></Field>
            </div>
            <Field label="Mô tả món"><textarea className="input" rows={2} name="description" placeholder="Thành phần, đặc điểm món..." /></Field>
            <button type="submit" className="btn w-full">Thêm vào Thực đơn</button>
          </form>
        </Panel>
      </div>

      <Panel title="Danh mục hiện có" right={<span className="text-sm text-muted">{categories.length} danh mục</span>}>
        <div className="space-y-6">
          {categories.map((cat) => {
            const catProducts = products.filter((p) => p.categoryId === cat.id);
            return (
              <section key={cat.id} className="rounded-xl border border-line bg-surface-soft p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">{cat.emoji}</span>
                    <div>
                      <strong className="block text-ink">{cat.name}</strong>
                      <small className="text-xs text-muted">{cat.slug} · {cat.productCount} sản phẩm</small>
                    </div>
                  </div>
                  <Badge tone={cat.active ? "green" : "gray"}>{cat.active ? "Đang bán" : "Đã tắt"}</Badge>
                </div>

                {catProducts.length === 0 ? (
                  <p className="rounded-lg bg-white px-3 py-4 text-center text-sm text-muted">Danh mục này chưa có sản phẩm.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg bg-white">
                    <table className="w-full min-w-[720px]">
                      <thead>
                        <tr className="border-b border-line">
                          <th className="th">Sản phẩm</th>
                          <th className="th">Giá</th>
                          <th className="th">Giá vốn</th>
                          <th className="th">Kho</th>
                          <th className="th">Trạng thái</th>
                          <th className="th">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {catProducts.map((p) => (
                          <CatalogProductRow key={p.id} product={p} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
          {categories.length === 0 && <EmptyState>Chưa có danh mục nào.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function CatalogProductRow({ product }: { product: Product }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const save = (e: FormEvent) => {
    e.preventDefault();
    toast.push(`Đã lưu sản phẩm "${product.name}".`, "success");
    setEditing(false);
  };

  return (
    <tr className="hover:bg-surface-soft">
      <td className="td">
        <strong className="text-sm text-ink">{product.name}</strong>
        <small className="block text-xs text-muted">{product.nameEn}</small>
      </td>
      <td className="td"><strong className="font-bold tabular-nums text-ink">{formatVnd(product.priceVnd)}</strong></td>
      <td className="td tabular-nums text-muted">{formatVnd(product.defaultCostVnd)}</td>
      <td className="td">
        {product.stockCounts ? (
          <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${product.stockCounts.available === 0 ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>
            {product.stockCounts.available}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="td">
        <Badge tone={product.active ? "green" : "gray"}>{product.active ? "Đang bán" : "Đã tắt"}</Badge>
      </td>
      <td className="td">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setEditing(!editing)}>{editing ? "Đóng" : "Sửa"}</button>
          <button type="button" className="btn-ghost" onClick={() => toast.push(`Đã ${product.active ? "tắt" : "bật"} bán "${product.name}".`, "success")}>
            {product.active ? "Tắt bán" : "Bật bán"}
          </button>
          <button type="button" className="btn-danger" onClick={() => toast.push(`Đã xóa sản phẩm "${product.name}".`, "warning")}>Xóa</button>
        </div>
        {editing && (
          <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tên"><input className="input" defaultValue={product.name} required /></Field>
              <Field label="Tên tiếng Anh"><input className="input" defaultValue={product.nameEn} /></Field>
              <Field label="Giá"><input className="input" defaultValue={product.priceVnd} inputMode="numeric" required /></Field>
              <Field label="Giá vốn"><input className="input" defaultValue={product.defaultCostVnd} inputMode="numeric" /></Field>
              <Field label="Danh mục">
                <select className="input" defaultValue={product.categoryId}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Bảo hành"><input className="input" defaultValue={product.warrantyNote} /></Field>
            </div>
            <Field label="Mô tả"><textarea className="input" rows={2} defaultValue={product.description} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Hủy</button>
              <button type="submit" className="btn">Lưu sản phẩm</button>
            </div>
          </form>
        )}
      </td>
    </tr>
  );
}
