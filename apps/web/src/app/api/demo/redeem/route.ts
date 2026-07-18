import { NextResponse } from "next/server";
import { demoEnabled, redeemPack } from "@brutality/core";
import { getSession } from "@/lib/session";

/**
 * Demo-only replacement for the Discord bot's !redeem: lets the signed-in
 * (guest) session redeem a pack credit directly from the web UI.
 * Returns 404 unless DEMO=true on the web service.
 */
export async function POST(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = process.env.BASE_URL ?? new URL(request.url).origin;
  const result = redeemPack(session.discordId, base);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
