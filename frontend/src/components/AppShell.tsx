"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider, useToast } from "./Toast";

/* ── Icon set (stroke SVG nhẹ nhàng, đồng bộ kiểu Donezo) ── */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M6 3h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M8 7h4M8 10h4M8 13h2" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <rect x="2" y="4.5" width="16" height="11" rx="2" />
      <path d="M2 8.5h16" />
      <circle cx="6" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <circle cx="8" cy="7" r="3" />
      <path d="M2 17c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <path d="M15 4.5a2.5 2.5 0 0 1 0 5M18 17c0-2.2-1.1-4-2.5-4.9" />
    </svg>
  ),
  catalog: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M3 5.5L10 2l7 3.5v9L10 18l-7-3.5v-9Z" />
      <path d="M3 5.5l7 3.5 7-3.5M10 9v9" />
    </svg>
  ),
  categories: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M4 3h5v5H4zM11 3h5v5h-5zM4 12h5v5H4zM11 12h5v5h-5z" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M3 3v14h14" />
      <path d="M7 14v-4M11 14V7M15 14v-6" />
    </svg>
  ),
  reconcile: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M16 12l-2 2-2-2M14 14V6M4 8l2-2 2 2M6 6v8" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v3.5l2.5 1.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.8 8a2.3 2.3 0 1 1 3 2.2c-.7.3-1 .7-1 1.5M10 14.5h.01" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" {...stroke} aria-hidden>
      <path d="M7 15L2 10l5-5M2 10h11M13 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
    </svg>
  ),
};

/* ── Điều hướng ── */
interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "MENU",
    items: [{ href: "/dashboard", label: "Tổng quan", icon: "dashboard" }],
  },
  {
    section: "QUẢN LÝ",
    items: [
      { href: "/orders", label: "Đơn hàng", icon: "orders" },
      { href: "/payments", label: "Thanh toán", icon: "payments" },
      { href: "/reconciliations", label: "Đối soát", icon: "reconcile" },
      { href: "/users", label: "Nhân viên", icon: "users" },
      { href: "/audit", label: "Nhật ký", icon: "audit" },
    ],
  },
  {
    section: "SẢN PHẨM",
    items: [
      { href: "/catalog", label: "Thực đơn", icon: "catalog" },
      { href: "/categories", label: "Danh mục", icon: "categories" },
    ],
  },
  {
    section: "GENERAL",
    items: [{ href: "/reports/revenue", label: "Báo cáo doanh thu", icon: "analytics" }],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-600/25">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 17c-3-2-6-4.5-6-8.5A4 4 0 0 1 8 4.5c1.4 0 2 .8 2 .8s.6-.8 2-.8a4 4 0 0 1 4 4c0 4-3 6.5-6 8.5Z" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <strong className="block text-[15px] font-extrabold tracking-tight text-ink">Bot Tele</strong>
          <small className="block text-xs font-medium text-muted">Admin Dashboard</small>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <nav className="space-y-5">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {group.section}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-forest-800 font-semibold text-white shadow-[0_2px_8px_rgba(15,61,36,0.25)]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span
                      className={`transition-colors ${
                        active ? "text-brand-300" : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    >
                      {ICONS[item.icon]}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ── Menu dưới cùng ── */
function SidebarFooter() {
  const toast = useToast();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  const footerItems: { href?: string; label: string; icon: string; onClick?: () => void }[] = [
    { href: "/settings", label: "Cài đặt", icon: "settings" },
    { label: "Trợ giúp", icon: "help", onClick: () => toast.push("Tài liệu hướng dẫn sẽ sớm được cập nhật.", "warning") },
    { href: "/login", label: "Đăng xuất", icon: "logout" },
  ];
  return (
    <div>
      <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">GENERAL</p>
      <ul className="space-y-0.5">
        {footerItems.map((item) =>
          item.href ? (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "bg-forest-800 font-semibold text-white shadow-[0_2px_8px_rgba(15,61,36,0.25)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className={isActive(item.href) ? "text-brand-300" : "text-slate-400"}>{ICONS[item.icon]}</span>
                {item.label}
              </Link>
            </li>
          ) : (
            <li key={item.label}>
              <button
                type="button"
                onClick={item.onClick}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
              >
                <span className="text-slate-400">{ICONS[item.icon]}</span>
                {item.label}
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4 overscroll-contain">
      <div className="px-1 pt-1">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none overscroll-contain">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-line pt-4">
        <SidebarFooter />
      </div>
    </div>
  );
}

/* ── Header phía trên (Donezo: search + bell + message + avatar) ── */
function TopHeader({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-white px-4 shadow-xs lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-drawer-open
          onClick={onOpenDrawer}
          aria-label="Mở menu điều hướng"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        {/* Search */}
        <label className="hidden items-center gap-2.5 rounded-xl border border-line bg-slate-50/80 px-4 py-2.5 text-sm text-slate-400 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/15 sm:flex sm:w-64 md:w-80">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" {...stroke} aria-hidden>
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" />
          </svg>
          <input
            type="search"
            placeholder="Tìm kiếm đơn hàng, khách hàng…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Bell */}
        <button
          type="button"
          aria-label="Thông báo"
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
            <path d="M10 2.5a5 5 0 0 1 5 5c0 3.5 1.5 5 2 5.5H3c.5-.5 2-2 2-5.5a5 5 0 0 1 5-5Z" />
            <path d="M8.5 16a1.8 1.8 0 0 0 3 0" />
          </svg>
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        {/* Message */}
        <button
          type="button"
          aria-label="Tin nhắn"
          className="relative hidden h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:flex"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
            <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v8A1.5 1.5 0 0 1 15.5 15h-7L5 17.5V15H4.5A1.5 1.5 0 0 1 3 13.5v-8Z" />
            <path d="M6.5 8.5h7M6.5 11h4.5" />
          </svg>
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-forest-800 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </button>

        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />

        {/* Avatar + name/email */}
        <div className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-1.5 transition hover:bg-slate-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-forest-600 to-forest-900 text-sm font-bold text-white shadow-sm">
            A
          </span>
          <div className="hidden leading-tight md:block">
            <strong className="block text-[13px] font-bold text-ink">admin</strong>
            <small className="block text-[11px] text-muted">admin@bottele.vn</small>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        (e.target as HTMLElement).closest("[data-drawer-open]") === null
      ) {
        drawerRef.current.classList.add("hidden");
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const openDrawer = () => {
    const el = drawerRef.current;
    if (el) el.classList.toggle("hidden");
  };

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* Sidebar desktop */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-sidebar overscroll-contain lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Drawer mobile */}
        <div ref={drawerRef} className="fixed inset-0 z-50 hidden lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Đóng menu"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              ×
            </button>
            <SidebarContent pathname={pathname} onNavigate={openDrawer} />
          </div>
        </div>

        {/* Workspace */}
        <div className="lg:pl-64">
          <TopHeader onOpenDrawer={openDrawer} />
          <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-10 lg:px-8 lg:pt-6 lg:pb-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
