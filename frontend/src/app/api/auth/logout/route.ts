import { NextResponse } from "next/server";
import { API_BASE_URL, clearSessionCookies, readSessionTokens } from "@/lib/server-api";

export async function POST() {
  const { accessToken } = await readSessionTokens();
  if (accessToken) {
    await fetch(`${API_BASE_URL}/admin/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
