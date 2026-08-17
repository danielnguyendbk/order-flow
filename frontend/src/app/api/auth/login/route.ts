import { NextResponse } from "next/server";
import { API_BASE_URL, setSessionCookies } from "@/lib/server-api";

export async function POST(request: Request) {
  const upstream = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ message: "API backend chưa sẵn sàng." }, { status: 503 });
  }

  const payload = await upstream.json();
  const response = NextResponse.json(upstream.ok ? { user: payload.data.user } : payload, { status: upstream.status });
  if (upstream.ok) await setSessionCookies(response, payload.data);
  return response;
}
