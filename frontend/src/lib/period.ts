/** Bộ lọc theo khoảng thời gian: Ngày / Tuần / Tháng / Năm. */

export type Period = "day" | "week" | "month" | "year";

export const PERIOD_OPTIONS: { value: Period | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

/** Day bắt đầu từ 00:00:00 hôm nay */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Ngày bắt đầu/ kết thúc của một khoảng thời gian quanh ngày hiện tại. */
export function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();

  if (period === "day") {
    return { from: startOfDay(now), to: new Date(now.setHours(23, 59, 59, 999)) };
  }

  if (period === "week") {
    // Tuần bắt đầu từ thứ 2
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=CN -> 6; others Sunday
    const monday = startOfDay(now);
    monday.setDate(now.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday, to: sunday };
  }

  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  // year
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
  };
}

/** True nếu thời điểm `dateIso` nằm trong khoảng thời gian đang chọn ("" = tất cả). */
export function inPeriod(dateIso: string | Date, period: Period | ""): boolean {
  if (!period) return true;
  const d = new Date(dateIso);
  const { from, to } = periodRange(period);
  return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
}

/** Định dạng Date -> "yyyy-MM-dd" cho ô <input type="date">. */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}