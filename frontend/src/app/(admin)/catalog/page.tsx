"use client";

import { useState, Fragment, type FormEvent } from "react";
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
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Icon/emoji"><input className="input" name="emoji" placeholder="☕" /></Field>
              <Field label="Thứ tự"><input className="input" type="number" defaultValue={0} name="sortOrder" /></Field>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-line accent-forest-800 cursor-pointer" /> Bật hiển thị
                </label>
              </div>
            </div>
            <Field label="Mô tả danh mục"><textarea className="input" rows={2} name="description" placeholder="Mô tả ngắn gọn về danh mục này..." /></Field>
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
        {categories.length === 0 ? (
          <EmptyState>Chưa có danh mục nào.</EmptyState>
        ) : (
          <div className="space-y-5">
            {categories.map((cat) => {
              const catProducts = products.filter((p) => p.categoryId === cat.id);
              return (
                <div key={cat.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
                  {/* Category Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-xs ring-1 ring-black/5">
                        {cat.emoji || "•"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-base font-bold text-ink">{cat.name}</strong>
                          <span className="rounded-md bg-slate-200/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                            {cat.slug}
                          </span>
                        </div>
                        <span className="text-xs text-muted">{cat.productCount} sản phẩm trong danh mục</span>
                      </div>
                    </div>
                    <Badge tone={cat.active ? "green" : "gray"}>{cat.active ? "Đang bán" : "Đã tắt"}</Badge>
                  </div>

                  {/* Products Table with Fixed Colgroup */}
                  {catProducts.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-muted">
                      Chưa có sản phẩm nào trong danh mục này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] table-fixed">
                        <colgroup>
                          <col className="w-[30%]" />
                          <col className="w-[15%]" />
                          <col className="w-[15%]" />
                          <col className="w-[10%]" />
                          <col className="w-[12%]" />
                          <col className="w-[18%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-line-soft bg-slate-50/40 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="px-5 py-2.5">Sản phẩm</th>
                            <th className="px-4 py-2.5">Giá bán</th>
                            <th className="px-4 py-2.5">Giá vốn</th>
                            <th className="px-4 py-2.5 text-center">Kho</th>
                            <th className="px-4 py-2.5">Trạng thái</th>
                            <th className="px-5 py-2.5 text-right">Thao tác</th>
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
                </div>
              );
            })}
          </div>
        )}
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
    <Fragment>
      <tr className="border-b border-line-soft transition hover:bg-slate-50/60">
        <td className="px-5 py-3">
          <strong className="text-sm font-bold text-ink">{product.name}</strong>
          <small className="block text-xs text-muted">{product.nameEn}</small>
        </td>
        <td className="px-4 py-3"><strong className="font-bold tabular-nums text-ink">{formatVnd(product.priceVnd)}</strong></td>
        <td className="px-4 py-3 tabular-nums text-slate-600">{formatVnd(product.defaultCostVnd)}</td>
        <td className="px-4 py-3 text-center">
          {product.stockCounts ? (
            <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${product.stockCounts.available === 0 ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>
              {product.stockCounts.available}
            </span>
          ) : (
            <span className="text-muted">-</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <Badge tone={product.active ? "green" : "gray"}>{product.active ? "Đang bán" : "Đã tắt"}</Badge>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => setEditing(!editing)}>
              {editing ? "Đóng" : "Sửa"}
            </button>
            <button type="button" className="btn-ghost text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => toast.push(`Đã ${product.active ? "tắt" : "bật"} bán "${product.name}".`, "success")}>
              {product.active ? "Tắt bán" : "Bật bán"}
            </button>
            <button type="button" className="btn-danger text-xs px-3 py-1 rounded-full whitespace-nowrap" onClick={() => toast.push(`Đã xóa sản phẩm "${product.name}".`, "warning")}>
              Xóa
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-brand-50/30 p-4 border-b border-line">
            <form onSubmit={save} className="space-y-3 rounded-xl border border-brand-200 bg-white p-4 shadow-xs">
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
          </td>
        </tr>
      )}
    </Fragment>
  );
}
