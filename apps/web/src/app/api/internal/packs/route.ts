import { NextResponse } from "next/server";
import { ensureCollector, creditBalance, initStore } from "@brutality/core";
import { botAuthorized } from "@/lib/botAuth";

/** Internal bot endpoint: pack credit balance for a Discord user. */
export async function GET(request: Request) {
  if (!botAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  initStore();

  const url = new URL(request.url);
  const discordId = url.searchParams.get("discordId");
  if (!discordId) {
    return NextResponse.json({ error: "discordId required" }, { status: 400 });
  }

  const collector = ensureCollector(discordId);
  const balance = creditBalance(collector.publicId);
  return NextResponse.json({
    available: balance.available,
    reserved: balance.reserved,
  });
}
