import { NextResponse } from "next/server";
import { initStore, listPublicProfiles } from "@brutality/core";

/** Current opt-in collector-to-Discord bindings. Not part of ledger history. */
export async function GET() {
  initStore();
  return NextResponse.json(
    {
      type: "CollectorProfileList",
      profiles: listPublicProfiles(),
    },
    {
      headers: {
        // Opt-out removes a profile from current state; do not retain stale
        // responses in shared caches.
        "Cache-Control": "no-store",
      },
    }
  );
}
