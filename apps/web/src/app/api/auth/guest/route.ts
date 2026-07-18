import { NextResponse } from "next/server";
import {
  demoEnabled,
  ensureCollector,
  initStore,
  DEMO_GUEST_DISCORD_ID,
  DEMO_GUEST_USERNAME,
} from "@brutality/core";
import { newSession, sessionCookie } from "@/lib/session";

/**
 * Demo-only Discord bypass: signs the visitor in as the shared guest
 * collector. Returns 404 unless DEMO=true on the web service.
 */
export async function GET(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const base = process.env.BASE_URL ?? new URL(request.url).origin;
  initStore();
  ensureCollector(DEMO_GUEST_DISCORD_ID, DEMO_GUEST_USERNAME);

  const response = NextResponse.redirect(`${base}/binder`);
  const cookie = sessionCookie(newSession(DEMO_GUEST_DISCORD_ID, DEMO_GUEST_USERNAME));
  response.cookies.set(cookie.name, cookie.value, cookie.options as any);
  return response;
}
