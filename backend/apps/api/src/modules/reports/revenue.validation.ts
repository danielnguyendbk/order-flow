export interface RevenueQuery {
  from: Date;
  to: Date;
}

export function parseRevenueQuery(query: any): RevenueQuery {
  const from = parseDate(query.from, startOfToday(), "start");
  const to = parseDate(query.to, endOfToday(), "end");

  if (Number.isNaN(from.getTime())) {
    throw Object.assign(new Error("from must be a valid ISO date"), { status: 400 });
  }

  if (Number.isNaN(to.getTime())) {
    throw Object.assign(new Error("to must be a valid ISO date"), { status: 400 });
  }

  if (from > to) {
    throw Object.assign(new Error("from must be before or equal to to"), { status: 400 });
  }

  return { from, to };
}

function parseDate(value: unknown, fallback: Date, boundary: "start" | "end"): Date {
  if (!value) return fallback;
  if (typeof value !== "string") return new Date(Number.NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";
    return new Date(`${value}T${time}+07:00`);
  }

  return new Date(value);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}
