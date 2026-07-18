import { NextResponse } from "next/server";
import { ensureCollector, redeemPack, baseUrl, initStore } from "@brutality/core";
import { botAuthorized } from "@/lib/botAuth";

/**
 * Internal bot endpoint: reserves a credit, commits a pull, and returns the
 * unique opening URL. Discord-side eligibility (roles, channel) is enforced
 * by the bot before calling this.
 */
export async function POST(request: Request) {
  if (!botAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  initStore();

  const body = (await request.json().catch(() => null)) as {
    discordId?: string;
    displayName?: string;
  } | null;
  if (!body?.discordId) {
    return NextResponse.json({ error: "discordId required" }, { status: 400 });
  }

  ensureCollector(body.discordId, body.displayName);
  const result = redeemPack(body.discordId, baseUrl());

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }
  return NextResponse.json({
    ok: true,
    url: result.url,
    expiresTs: result.redemption.expiresTs,
  });
}
