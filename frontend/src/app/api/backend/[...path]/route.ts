import { NextResponse } from "next/server";
import { API_BASE_URL, clearSessionCookies, readSessionTokens, setSessionCookies } from "@/lib/server-api";

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const target = `${API_BASE_URL}/${path.join("/")}${incomingUrl.search}`;
  let { accessToken, refreshToken } = await readSessionTokens();

  const send = (token?: string) => fetch(target, {
    method: request.method,
    headers: {
      ...(request.headers.get("content-type") ? { "content-type": request.headers.get("content-type")! } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.clone().body,
    cache: "no-store",
    // Required by Node fetch when forwarding a request stream.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  let upstream = await send(accessToken).catch(() => null);
  let refreshed: { accessToken: string; refreshToken: string; expiresIn: number } | null = null;

  if (upstream?.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => null);
    if (refreshResponse?.ok) {
      const payload = await refreshResponse.json();
      refreshed = payload.data;
      accessToken = refreshed!.accessToken;
      refreshToken = refreshed!.refreshToken;
      upstream = await send(accessToken).catch(() => null);
    }
  }

  if (!upstream) return NextResponse.json({ message: "API backend chưa sẵn sàng." }, { status: 503 });
  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json",
  });
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  if (refreshed) await setSessionCookies(response, refreshed);
  if (upstream.status === 401) clearSessionCookies(response);
  return response;
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
