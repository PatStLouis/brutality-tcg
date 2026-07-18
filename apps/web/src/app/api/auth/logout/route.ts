import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  const base = process.env.BASE_URL ?? new URL(request.url).origin;
  const response = NextResponse.redirect(`${base}/`);
  const cookie = clearedSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options as any);
  return response;
}
