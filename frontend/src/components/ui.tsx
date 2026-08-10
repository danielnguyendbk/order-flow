"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* ── Panel / card ── */
export function Panel({
  title,
  eyebrow,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  eyebrow?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-6 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── Page header ── */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pt-1 pb-2">
      <div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink lg:text-[26px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm font-normal text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/* ── Stats row ── */
export interface StatItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "green" | "amber" | "red" | "blue" | "gray" | "teal";
}

const STAT_TONES: Record<NonNullable<StatItem["tone"]>, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  blue: "text-blue-600",
  gray: "text-slate-500",
  teal: "text-brand-700",
};

const GRID_COLS_MAP: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
};

export function Stats({ items, className }: { items: StatItem[]; className?: string }) {
  const colsClass = GRID_COLS_MAP[items.length] ?? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6";

  return (
    <div className={`mb-6 grid items-stretch gap-3 ${colsClass} ${className ?? ""}`}>
      {items.map((item, i) => (
        <article key={i} className="card flex flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
          <div>
            <span className="block text-xs font-medium text-muted">{item.label}</span>
            <strong className={`mt-1 block text-lg font-extrabold tabular-nums ${STAT_TONES[item.tone ?? "teal"]}`}>
              {item.value}
            </strong>
          </div>
          {item.sub ? <span className="mt-1.5 block text-xs text-muted">{item.sub}</span> : null}
        </article>
      ))}
    </div>
  );
}

/* ── Status badge ── */
export type Tone = "green" | "amber" | "red" | "blue" | "gray" | "teal" | "violet";

const BADGE_TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/15",
  teal: "bg-brand-50 text-brand-700 ring-brand-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export function Badge({
  label,
  tone = "gray",
  children,
}: {
  label?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_TONES[tone]}`}
    >
      {children ?? label}
    </span>
  );
}

/* ── Order / payment status → tone ── */
export function orderPaymentTone(status: string): Tone {
  switch (status) {
    case "PAID":
      return "green";
    case "PENDING":
      return "amber";
    case "UNPAID":
      return "gray";
    case "UNDERPAID":
    case "OVERPAID":
    case "PAYMENT_REVIEW":
      return "red";
    case "REFUNDED":
      return "blue";
    default:
      return "gray";
  }
}

export function orderFulfillmentTone(status: string): Tone {
  switch (status) {
    case "DELIVERED":
      return "green";
    case "READY":
      return "teal";
    case "PREPARING":
      return "blue";
    case "QUEUED":
    case "PENDING_PAYMENT":
      return "amber";
    case "CANCELLED":
      return "red";
    default:
      return "gray";
  }
}

export function paymentTone(status: string): Tone {
  switch (status) {
    case "matched":
      return "green";
    case "pending":
    case "unknown_code":
      return "amber";
    case "underpaid":
    case "overpaid":
    case "duplicate":
    case "failed":
      return "red";
    default:
      return "gray";
  }
}

export function warrantyTone(status: string): Tone {
  switch (status) {
    case "open":
      return "blue";
    case "processing":
    case "waiting_customer":
      return "amber";
    case "resolved":
      return "green";
    case "rejected":
    case "closed":
      return "gray";
    default:
      return "gray";
  }
}

/* ── Empty state ── */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

/* ── Form field wrapper ── */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/* ── Modal (dùng <dialog> native) ── */
export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (el.open) el.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!isInDialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleBackdropClick}
      className="m-auto w-full rounded-2xl bg-white p-0 shadow-2xl outline-none backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
      style={{ maxWidth: wide ? "min(94vw, 760px)" : "min(94vw, 520px)" }}
    >
      {/* Chỉ mount nội dung khi mở để tránh form defaultValue bị stale giữa các lần mở */}
      {open && (
        <div className="max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-4">
            <div>
              {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ×
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/* ── Hạng khách hàng ── */
export function RankBadge({ tier, name }: { tier: string; name: string }) {
  const map: Record<string, string> = {
    diamond: "from-cyan-500 to-blue-600 text-white",
    platinum: "from-slate-400 to-slate-600 text-white",
    gold: "from-amber-400 to-amber-600 text-white",
    silver: "from-slate-300 to-slate-400 text-slate-700",
    bronze: "from-orange-400 to-orange-600 text-white",
    new: "from-slate-200 to-slate-300 text-slate-600",
  };
  const cls = map[tier] ?? map.new;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-xs font-bold shadow-sm ${cls}`}>
      {name}
    </span>
  );
}

/* ── Fulfillment badge ── */
export function FulfillmentBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    stock: { label: "Kho tự động", cls: "bg-brand-50 text-brand-700 ring-brand-600/15" },
    manual_upgrade: { label: "Nâng cấp thủ công", cls: "bg-violet-50 text-violet-700 ring-violet-600/15" },
    dealer_api: { label: "API đối tác", cls: "bg-blue-50 text-blue-700 ring-blue-600/15" },
  };
  const meta = map[type] ?? { label: type, cls: "bg-slate-100 text-slate-600 ring-slate-500/15" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ── Spinner icon ── */
export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeMap = {
    sm: "h-4 w-4 stroke-[2.5]",
    md: "h-6 w-6 stroke-[2]",
    lg: "h-10 w-10 stroke-[2]",
  };
  return (
    <svg
      className={`animate-spin text-emerald-600 ${sizeMap[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/* ── Component hiển thị màn hình Đang tải toàn trang/tính năng ── */
export function PageLoading({
  label = "Đang tải dữ liệu...",
  subText = "Vui lòng chờ trong giây lát",
}: {
  label?: string;
  subText?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col items-center justify-center py-8 text-center animate-[fadeUp_.3s_ease-out]">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-emerald-500/15 animate-ping" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100/80 shadow-inner ring-1 ring-emerald-500/20">
          <Spinner size="lg" />
        </div>
      </div>
      <h3 className="mt-6 text-lg font-extrabold text-slate-800 tracking-tight">{label}</h3>
      {subText && <p className="mt-2 text-sm font-medium text-slate-400">{subText}</p>}
    </div>
  );
}

/* ── Skeleton Loader ── */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}
