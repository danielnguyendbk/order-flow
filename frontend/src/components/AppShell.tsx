"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "./Toast";

/* ── Icon set (stroke SVG, giữ đồng bộ với thiết kế cũ) ── */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M7 18v-6h6v6" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h4" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <path d="M2 9h16" />
      <circle cx="6" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <circle cx="8" cy="7" r="3" />
      <path d="M2 18c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <path d="M15 4a3 3 0 0 1 0 6M18 18c0-2.761-1.343-5-3-6" />
    </svg>
  ),
  catalog: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M6 7h8M6 10h5" />
    </svg>
  ),
  categories: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke} aria-hidden>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v4l3 2" />
    </svg>
  ),
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Tổng quan",
    items: [{ href: "/dashboard", label: "Tổng quan", icon: "dashboard" }],
  },
  {
    section: "Bán hàng",
    items: [
      { href: "/orders", label: "Đơn hàng", icon: "orders" },
      { href: "/payments", label: "Thanh toán", icon: "payments" },
      { href: "/users", label: "Khách hàng", icon: "users" },
    ],
  },
  {
    section: "Thực đơn",
    items: [
      { href: "/catalog", label: "Thực đơn", icon: "catalog" },
      { href: "/categories", label: "Danh mục", icon: "categories" },
    ],
  },
  {
    section: "Hệ thống",
    items: [
      { href: "/settings", label: "Cấu hình", icon: "settings" },
      { href: "/audit", label: "Nhật ký", icon: "audit" },
    ],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-extrabold text-white shadow-lg shadow-brand-900/40">
        BT
      </span>
      {!compact && (
        <span className="leading-tight">
          <strong className="block text-[15px] font-bold text-white">Bot Tele</strong>
          <small className="block text-xs text-slate-400">Quản trị viên</small>
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
          <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
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
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-brand-600/90 font-semibold text-white shadow-md shadow-brand-900/30"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className={active ? "text-white" : "text-slate-500 group-hover:text-brand-300"}>
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

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">
            A
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <strong className="block truncate text-sm text-white">admin</strong>
            <small className="text-xs text-slate-400">Quản trị viên</small>
          </div>
          <Link
            href="/login"
            aria-label="Đăng xuất"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700/50 hover:text-white"
            title="Đăng xuất"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 15L2 10l5-5" />
              <path d="M2 10h11" />
              <path d="M12 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

function titleFor(pathname: string): string {
  for (const group of NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) return item.label;
    }
  }
  return "Bot Tele";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titleFor(pathname);
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
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-sidebar lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Drawer mobile */}
        <div
          ref={drawerRef}
          className="fixed inset-0 z-50 hidden lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Đóng menu"
              className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
            <SidebarContent pathname={pathname} onNavigate={openDrawer} />
          </div>
        </div>

        {/* Workspace */}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/85 px-4 backdrop-blur lg:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-drawer-open
                onClick={openDrawer}
                aria-label="Mở menu điều hướng"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
              </button>
              <strong className="text-sm font-bold text-ink lg:text-[15px]">{title}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/orders?needsAction=1"
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:block"
              >
                Đơn cần xử lý
              </Link>
              <Link
                href="/settings"
                aria-label="Cấu hình"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white transition hover:opacity-90"
              >
                A
              </Link>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
