"use client";

import { PERIOD_OPTIONS, type Period } from "@/lib/period";

/**
 * Bộ lọc khoảng thời gian dạng nút chọn: Tất cả / Ngày / Tuần / Tháng / Năm.
 */
export function PeriodFilter({
  value,
  onChange,
  className = "",
}: {
  value: Period | "";
  onChange: (period: Period | "") => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-lg border border-line bg-slate-50 p-0.5 ${className}`}>
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
            value === opt.value ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}