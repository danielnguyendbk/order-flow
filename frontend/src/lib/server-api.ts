import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "order_flow_access";
const REFRESH_COOKIE = "order_flow_refresh";

export const API_BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function setSessionCookies(response: NextResponse, session: SessionPayload) {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, { ...cookieOptions, maxAge: session.expiresIn });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function readSessionTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}
